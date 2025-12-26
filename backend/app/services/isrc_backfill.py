"""
ISRC Backfill Service

Backfills missing ISRCs for tracks that have Spotify links but no ISRC.
This happens when tracks were ingested using album_tracks() which doesn't include external_ids.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.core.models import Track, PlaybackLink
from app.core.config import settings
import time


class ISRCBackfillService:
    """Service to backfill ISRCs for existing tracks from Spotify."""

    def __init__(self, db: Session):
        self.db = db
        self.sp = None

    def _init_spotify(self):
        """Lazy initialize Spotify client."""
        if self.sp is None:
            import spotipy
            from spotipy.oauth2 import SpotifyClientCredentials

            client_credentials_manager = SpotifyClientCredentials(
                client_id=settings.SPOTIPY_CLIENT_ID,
                client_secret=settings.SPOTIPY_CLIENT_SECRET
            )
            self.sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

    def get_tracks_needing_isrc(self, limit: int = None):
        """
        Get tracks that have Spotify links but either:
        1. No ISRC at all (NULL)
        2. Fallback ISRC (starts with 'FALLBACK-')
        """
        query = self.db.query(Track).join(
            Track.playback_links
        ).filter(
            and_(
                PlaybackLink.platform == "spotify",
                PlaybackLink.is_working == True,
                # Either no ISRC or a fallback ISRC
                (Track.isrc == None) | (Track.isrc.like('FALLBACK-%'))
            )
        ).distinct()

        if limit:
            query = query.limit(limit)

        return query.all()

    def backfill_isrcs(self, limit: int = None, batch_size: int = 50) -> dict:
        """
        Backfill ISRCs for tracks missing them.

        Args:
            limit: Maximum number of tracks to process (None for all)
            batch_size: Number of tracks to fetch from Spotify at once (max 50)

        Returns:
            Dictionary with statistics about the backfill operation
        """
        self._init_spotify()

        tracks_to_update = self.get_tracks_needing_isrc(limit)
        total_tracks = len(tracks_to_update)

        if total_tracks == 0:
            return {
                "total_processed": 0,
                "isrcs_updated": 0,
                "failed": 0,
                "message": "No tracks need ISRC backfill"
            }

        print(f"🔄 Starting ISRC backfill for {total_tracks} tracks...")

        updated_count = 0
        failed_count = 0

        # Process in batches
        for i in range(0, total_tracks, batch_size):
            batch_tracks = tracks_to_update[i:i+batch_size]

            # Get Spotify IDs from playback links
            spotify_ids = []
            track_map = {}  # Map spotify_id -> Track object

            for track in batch_tracks:
                for link in track.playback_links:
                    if link.platform == "spotify" and link.is_working:
                        spotify_id = link.deep_link  # This stores just the Spotify ID
                        spotify_ids.append(spotify_id)
                        track_map[spotify_id] = track
                        break  # Only need one Spotify link per track

            if not spotify_ids:
                continue

            try:
                # Fetch full track details from Spotify
                batch_response = self.sp.tracks(spotify_ids)
                spotify_tracks = batch_response.get('tracks', [])

                for sp_track in spotify_tracks:
                    if not sp_track:
                        continue

                    spotify_id = sp_track['id']
                    db_track = track_map.get(spotify_id)

                    if not db_track:
                        continue

                    # Extract ISRC
                    external_ids = sp_track.get('external_ids', {})
                    isrc = external_ids.get('isrc')

                    if isrc:
                        old_isrc = db_track.isrc

                        # Check if this ISRC already exists on a different track
                        existing_track = self.db.query(Track).filter(
                            Track.isrc == isrc,
                            Track.id != db_track.id
                        ).first()

                        if existing_track:
                            print(f"   ⚠️  Duplicate: {db_track.title} has same ISRC as existing track (skipping)")
                            failed_count += 1
                        else:
                            db_track.isrc = isrc

                            # Commit immediately after each track to prevent duplicate ISRC conflicts within batch
                            try:
                                self.db.commit()
                                updated_count += 1

                                if old_isrc and old_isrc.startswith('FALLBACK-'):
                                    print(f"   ✅ Updated fallback ISRC: {db_track.title} -> {isrc}")
                                else:
                                    print(f"   ✅ Added ISRC: {db_track.title} -> {isrc}")
                            except Exception as commit_error:
                                self.db.rollback()
                                print(f"   ⚠️  Failed to update {db_track.title}: {commit_error}")
                                failed_count += 1
                    else:
                        print(f"   ⚠️  No ISRC available for: {db_track.title}")
                        failed_count += 1

                # Rate limiting: 1 second delay to stay under Spotify's ~3 req/sec limit
                # With batches of 50, this gives us ~60 batches/min well under 180 req/min
                if i + batch_size < total_tracks:
                    time.sleep(1.0)

            except Exception as e:
                print(f"❌ Error processing batch: {e}")
                self.db.rollback()
                failed_count += len(batch_tracks)

        print(f"✅ ISRC backfill complete!")
        print(f"   Total processed: {total_tracks}")
        print(f"   ISRCs updated: {updated_count}")
        print(f"   Failed: {failed_count}")

        return {
            "total_processed": total_tracks,
            "isrcs_updated": updated_count,
            "failed": failed_count,
            "message": f"Successfully updated {updated_count} ISRCs"
        }

    def get_backfill_stats(self) -> dict:
        """Get statistics about tracks that need ISRC backfill."""
        total_tracks = self.db.query(Track).count()

        tracks_with_isrc = self.db.query(Track).filter(
            Track.isrc != None,
            ~Track.isrc.like('FALLBACK-%')
        ).count()

        tracks_with_fallback = self.db.query(Track).filter(
            Track.isrc.like('FALLBACK-%')
        ).count()

        tracks_without_isrc = self.db.query(Track).filter(
            Track.isrc == None
        ).count()

        tracks_needing_backfill = len(self.get_tracks_needing_isrc())

        return {
            "total_tracks": total_tracks,
            "tracks_with_real_isrc": tracks_with_isrc,
            "tracks_with_fallback_isrc": tracks_with_fallback,
            "tracks_without_isrc": tracks_without_isrc,
            "tracks_needing_backfill": tracks_needing_backfill,
        }
