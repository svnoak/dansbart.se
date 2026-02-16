"""
Spotify Ingestor - Import tracks from Spotify playlists and artist discographies.

MIT Licensed - No AGPL dependencies.
"""
import hashlib
import time
from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.core.config import settings
from app.core.models import Album, TrackAlbum

import structlog

log = structlog.get_logger()


class SpotifyIngestor:
    """Ingest tracks from Spotify playlists, albums, and artist discographies."""

    def __init__(self, db: Session):
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials

        self.db = db
        self.repo = TrackRepository(db)

        client_credentials_manager = SpotifyClientCredentials(
            client_id=settings.SPOTIPY_CLIENT_ID,
            client_secret=settings.SPOTIPY_CLIENT_SECRET
        )
        self.sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

    def ingest_playlist(self, playlist_id: str) -> list[str]:
        """
        Ingest all tracks from a Spotify playlist.

        Args:
            playlist_id: Spotify playlist ID

        Returns:
            List of track IDs that need analysis (PENDING status only)
        """
        log.info("starting_playlist_ingestion", playlist_id=playlist_id)
        try:
            results = self.sp.playlist_tracks(playlist_id)
        except Exception as e:
            log.error("playlist_ingestion_failed", playlist_id=playlist_id, error=str(e))
            return []

        processed_ids = []

        while results:
            raw_items = [item.get('track') for item in results['items']]
            batch_ids = self.ingest_tracks_from_list(raw_items)
            processed_ids.extend(batch_ids)

            if results['next']:
                results = self.sp.next(results)
            else:
                results = None

        log.info("playlist_ingestion_complete", playlist_id=playlist_id, tracks_queued=len(processed_ids))
        return processed_ids

    def ingest_tracks_from_list(self, track_items: list) -> list[str]:
        """
        Process a list of Spotify track objects.

        Returns list of track IDs that need analysis (PENDING status only).
        Fetches full track details to ensure ISRCs are available.
        """
        pending_ids = []
        skipped_count = 0

        # Extract track IDs and filter out invalid tracks
        track_ids = []
        track_map = {}
        for track in track_items:
            if track and not track.get('is_local') and track.get('id'):
                track_id = track['id']
                track_ids.append(track_id)
                track_map[track_id] = track

        if not track_ids:
            return pending_ids

        # Batch fetch full track details to get ISRCs (up to 50 at a time)
        full_tracks = []
        for i in range(0, len(track_ids), 50):
            batch_ids = track_ids[i:i+50]
            try:
                batch_response = self.sp.tracks(batch_ids)
                batch_tracks = batch_response.get('tracks', [])

                # Merge full track data with original album data
                for full_track in batch_tracks:
                    if full_track:
                        track_id = full_track['id']
                        original_track = track_map.get(track_id, {})

                        # Preserve album data if injected
                        if 'album' in original_track and original_track['album']:
                            full_track['album'] = original_track['album']

                        full_tracks.append(full_track)

            except Exception as e:
                log.error("track_details_batch_fetch_failed", error=str(e))
                # Fallback to simplified tracks if batch fetch fails
                for track_id in batch_ids:
                    original_track = track_map.get(track_id)
                    if original_track:
                        full_tracks.append(original_track)

        # Process all tracks
        for track in full_tracks:
            if not track:
                continue

            try:
                db_track = self._process_single_track(track)
                if db_track:
                    # Only queue for analysis if not already processed
                    if db_track.processing_status == "PENDING":
                        pending_ids.append(str(db_track.id))
                    else:
                        skipped_count += 1
            except Exception as e:
                log.error("track_processing_failed", error=str(e))

        if skipped_count > 0:
            log.info("tracks_skipped_already_processed", skipped_count=skipped_count)

        return pending_ids

    def ingest_album(self, album_id: str) -> list[str]:
        """Ingest all tracks from a single album."""
        log.info("fetching_album", album_id=album_id)

        try:
            album = self.sp.album(album_id)
            album_name = album.get('name', 'Unknown')
            log.info("album_fetched", album_id=album_id, album_name=album_name)

            tracks_to_save = []
            album_tracks_results = self.sp.album_tracks(album_id)

            while album_tracks_results:
                for track in album_tracks_results['items']:
                    # Inject album object for _process_single_track
                    track['album'] = album
                    tracks_to_save.append(track)

                if album_tracks_results['next']:
                    album_tracks_results = self.sp.next(album_tracks_results)
                else:
                    album_tracks_results = None

            pending_ids = self.ingest_tracks_from_list(tracks_to_save)
            log.info("album_ingestion_complete", album_id=album_id, album_name=album_name, tracks_queued=len(pending_ids))
            return pending_ids

        except Exception as e:
            log.error("album_ingestion_failed", album_id=album_id, error=str(e))
            return []

    def ingest_artist_albums(self, artist_id: str) -> list[str]:
        """
        Ingest all albums and tracks for an artist.

        Args:
            artist_id: Spotify artist ID

        Returns:
            List of track IDs that need analysis
        """
        log.info("fetching_artist_discography", artist_id=artist_id)

        # Get all albums (Albums + Singles)
        albums = []
        results = self.sp.artist_albums(
            artist_id, album_type='album,single', country='SE', limit=50
        )

        while results:
            albums.extend(results['items'])
            if results['next']:
                results = self.sp.next(results)
            else:
                results = None

        log.info("artist_releases_found", artist_id=artist_id, release_count=len(albums))

        # Loop through every album to get tracks
        all_pending_ids = []
        for idx, album in enumerate(albums):
            try:
                # Gentle pacing: Small delay every 10 albums
                if idx > 0 and idx % 10 == 0:
                    time.sleep(1.0)

                album_tracks_results = self.sp.album_tracks(album['id'])

                tracks_to_save = []
                while album_tracks_results:
                    for track in album_tracks_results['items']:
                        # Inject album object for _process_single_track
                        track['album'] = album
                        tracks_to_save.append(track)

                    if album_tracks_results['next']:
                        album_tracks_results = self.sp.next(album_tracks_results)
                    else:
                        album_tracks_results = None

                # Batch save this album
                pending_ids = self.ingest_tracks_from_list(tracks_to_save)
                all_pending_ids.extend(pending_ids)

            except Exception as e:
                log.error("artist_album_processing_failed", album_name=album['name'], error=str(e))

        log.info("artist_discography_ingestion_complete", artist_id=artist_id, tracks_queued=len(all_pending_ids))
        return all_pending_ids

    def _process_single_track(self, sp_track: dict):
        """
        Process a single Spotify track and store in database.

        Returns the database Track object or None if processing failed.
        """
        external_ids = sp_track.get('external_ids', {})
        isrc = external_ids.get('isrc')
        title = sp_track.get('name')
        duration_ms = sp_track.get('duration_ms')

        # If no ISRC, generate a fallback identifier from track metadata
        if not isrc:
            album_obj = sp_track.get('album', {})
            album_name = album_obj.get('name', '')
            artists = sp_track.get('artists', [])
            first_artist = artists[0]['name'] if artists else ''

            # Normalize and create hash
            hash_input = f"{title}|{first_artist}|{album_name}|{duration_ms}".lower()
            hash_digest = hashlib.md5(hash_input.encode()).hexdigest()
            isrc = f"FALLBACK-{hash_digest[:12]}"
            log.warn("no_isrc_using_fallback", title=title, fallback_isrc=isrc)

        # Extract Album Info
        album_obj = sp_track.get('album', {})
        album_images = album_obj.get('images', [])
        cover_url = album_images[0]['url'] if album_images else None

        album_data = {
            'name': album_obj.get('name'),
            'cover': cover_url,
            'date': album_obj.get('release_date'),
            'spotify_id': album_obj.get('id')
        }

        # Extract Artists Info
        artists_data = []
        for artist in sp_track.get('artists', []):
            artists_data.append({
                'name': artist['name'],
                'id': artist['id']
            })

        # Database Interaction
        db_track = self.repo.get_by_isrc(isrc)

        if not db_track:
            log.info("new_track_found", title=title, isrc=isrc)
            db_track = self.repo.create_track(
                title=title,
                isrc=isrc,
                duration_ms=duration_ms,
                album_data=album_data,
                artists_data=artists_data
            )
        else:
            # Track exists - update missing data and add new album link if needed
            updated = False

            # Update duration if missing
            if not db_track.duration_ms and duration_ms:
                db_track.duration_ms = duration_ms
                updated = True

            # Add new album link if this track appears in a new album
            if album_data and album_data.get('name'):
                primary_artist_data = artists_data[0] if artists_data else None
                if primary_artist_data:
                    primary_artist = self.repo.get_or_create_artist(
                        primary_artist_data['name'],
                        primary_artist_data.get('id')
                    )

                    # Check if album exists (first by spotify_id)
                    album = None
                    if album_data.get('spotify_id'):
                        album = self.db.query(Album).filter(
                            Album.spotify_id == album_data['spotify_id']
                        ).first()

                    # Fall back to title + artist
                    if not album:
                        album = self.db.query(Album).filter(
                            Album.title == album_data['name'],
                            Album.artist_id == primary_artist.id
                        ).first()

                    if not album:
                        # Create new album
                        album = Album(
                            title=album_data['name'],
                            artist_id=primary_artist.id,
                            cover_image_url=album_data.get('cover'),
                            release_date=album_data.get('date'),
                            spotify_id=album_data.get('spotify_id')
                        )
                        self.db.add(album)
                        self.db.flush()
                    elif not album.spotify_id and album_data.get('spotify_id'):
                        album.spotify_id = album_data.get('spotify_id')
                        self.db.flush()

                    # Check if track is already linked to this album
                    existing_link = self.db.query(TrackAlbum).filter(
                        TrackAlbum.track_id == db_track.id,
                        TrackAlbum.album_id == album.id
                    ).first()

                    if not existing_link:
                        self.db.add(TrackAlbum(
                            track_id=db_track.id,
                            album_id=album.id
                        ))
                        updated = True

            if updated:
                self.db.commit()

        # Link Spotify ID
        spotify_id = sp_track.get('id')
        if spotify_id:
            self.repo.add_playback_link(
                track_id=db_track.id,
                platform="spotify",
                url=spotify_id
            )

        return db_track
