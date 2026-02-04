"""
Discovery Spider - Find new Swedish folk music artists on Spotify.

MIT Licensed - No AGPL dependencies.

Features:
- Genre classification
- Crawl tracking (no duplicate crawls)
- Multi-signal folk detection
- Statistics tracking
"""
import time
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.workers.ingestion.spotify import SpotifyIngestor
from app.repository.track import TrackRepository
from app.core.models import (
    Track, Artist, Album, TrackAlbum,
    ArtistCrawlLog, RejectionLog, PendingArtistApproval
)
from app.services.genre_classifier import GenreClassifier


class DiscoverySpider:
    """
    Enhanced Discovery Spider with:
    - Genre classification
    - Crawl tracking (no duplicate crawls)
    - Multi-signal folk detection
    - Statistics tracking
    """

    def __init__(self, db: Session):
        self.db = db
        self.ingestor = SpotifyIngestor(db)
        self.repo = TrackRepository(db)
        self.genre_classifier = GenreClassifier(db)
        # Reuse the Spotify client from the ingestor
        self.sp = self.ingestor.sp

        # Statistics
        self.stats = {
            'artists_evaluated': 0,
            'artists_passed_gatekeeper': 0,
            'artists_already_crawled': 0,
            'artists_rejected': 0,
            'artists_crawled': 0,
            'tracks_found': 0
        }

    def crawl_by_search(self, max_discoveries: int = 10) -> dict:
        """
        Search Spotify directly for folk artists/albums.
        Does not require seeds from the database.

        Args:
            max_discoveries: Maximum number of new artists to discover

        Returns:
            dict: Crawl statistics
        """
        print("[DiscoverySpider] Starting Search Mode...")
        print(f"   Max discoveries: {max_discoveries}")

        # Folk-related search queries
        search_queries = [
            "Swedish folk music",
            "spelmanslag",
            "folkmusik",
            "nyckelharpa",
            "polska music",
            "nordic folk",
            "scandinavian folk",
            "svensk folkmusik",
            "riksspelman",
            "traditional folk sweden"
        ]

        discovered_count = 0

        for query in search_queries:
            if discovered_count >= max_discoveries:
                print(f"[DiscoverySpider] Reached max discoveries limit ({max_discoveries})")
                break

            print(f"\n   Searching: '{query}'")

            try:
                results = self.sp.search(q=query, type='artist', limit=20)

                if not results.get('artists', {}).get('items'):
                    print(f"   No results for '{query}'")
                    continue

                for artist in results['artists']['items']:
                    if discovered_count >= max_discoveries:
                        break

                    if self._evaluate_and_ingest(artist):
                        discovered_count += 1

            except Exception as e:
                print(f"   Search error for '{query}': {e}")

        self._print_stats("Search Spider")
        return self.stats

    def backfill_existing_artists(
        self,
        max_artists: int = 20,
        discover_from_albums: bool = True
    ) -> dict:
        """
        Backfill method: Find all artists we have tracks for and ingest their
        complete discographies.

        Args:
            max_artists: Maximum number of artists to backfill
            discover_from_albums: If True, also discover new artists from
                                  compilation/collaborative albums

        Returns:
            dict: Crawl statistics
        """
        print("[DiscoverySpider] Starting Backfill Mode...")
        print(f"   Max artists to backfill: {max_artists}")
        print(f"   Discover from albums: {'Yes' if discover_from_albums else 'No'}")

        # Get all artists in our database that have a Spotify ID
        artists = self.db.query(Artist).filter(
            Artist.spotify_id.isnot(None)
        ).limit(max_artists * 2).all()

        if not artists:
            print("[DiscoverySpider] No artists found in database with Spotify IDs!")
            return self.stats

        print(f"   Found {len(artists)} artists in database")

        backfilled_count = 0

        for artist in artists:
            if backfilled_count >= max_artists:
                print(f"[DiscoverySpider] Reached max backfill limit ({max_artists})")
                break

            artist_id = artist.spotify_id
            artist_name = artist.name

            # Check if already crawled
            existing_log = self.db.query(ArtistCrawlLog).filter(
                ArtistCrawlLog.spotify_artist_id == artist_id
            ).first()

            if existing_log:
                self.stats['artists_already_crawled'] += 1
                print(f"   Skipping {artist_name} (already crawled on {existing_log.crawled_at.date()})")
                continue

            print(f"\n   Backfilling: {artist_name}")

            try:
                # Get artist details from Spotify for genre info
                sp_artist = self.sp.artist(artist_id)
                genres = sp_artist.get('genres', [])

                # Classify the artist's genre
                music_genre, confidence = self.genre_classifier.classify_artist_genre(
                    artist_name, genres, None
                )

                print(f"      Genre: {music_genre} ({confidence:.2f} confidence)")

                # Ingest full discography
                track_ids = self.ingestor.ingest_artist_albums(artist_id)

                # Log the backfill
                crawl_log = ArtistCrawlLog(
                    spotify_artist_id=artist_id,
                    artist_name=artist_name,
                    tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
                    status='success',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    discovery_source='backfill'
                )

                self.db.add(crawl_log)
                self.db.commit()

                # Update track genres for this artist
                tracks_updated = self.genre_classifier.classify_all_tracks_for_artist(artist_id)
                if tracks_updated > 0:
                    print(f"      Tagged {tracks_updated} tracks as '{music_genre}'")

                self.stats['artists_crawled'] += 1
                self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids
                backfilled_count += 1

            except Exception as e:
                print(f"      Error backfilling {artist_name}: {e}")

                # Log the failure
                try:
                    crawl_log = ArtistCrawlLog(
                        spotify_artist_id=artist_id,
                        artist_name=artist_name,
                        tracks_found=0,
                        status='failed',
                        detected_genres=[],
                        music_genre_classification='unknown',
                        discovery_source='backfill'
                    )
                    self.db.add(crawl_log)
                    self.db.commit()
                except Exception:
                    self.db.rollback()

        # PHASE 2: Discover new artists from albums (if enabled)
        discovered_from_albums = 0
        if discover_from_albums:
            print("\n" + "="*60)
            print("Phase 2: Discovering Artists from Albums")
            print("="*60)
            discovered_from_albums = self._discover_artists_from_albums(
                max_artists - backfilled_count
            )
            print(f"   Found {discovered_from_albums} new artists from albums")

        self._print_stats("Backfill Spider")
        return self.stats

    def _discover_artists_from_albums(self, max_to_discover: int) -> int:
        """
        Discover new Swedish/Nordic folk artists from albums in our database.

        Strategy: Look at albums featuring our existing artists and discover
        other artists on those albums (compilations, collaborations, etc.)
        """
        if max_to_discover <= 0:
            print("   Max discoveries limit reached, skipping album discovery")
            return 0

        discovered_count = 0

        # Get unique album Spotify IDs from our tracks
        album_spotify_ids = set()

        tracks_with_albums = self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).join(Album, TrackAlbum.album_id == Album.id).limit(100).all()

        for track in tracks_with_albums:
            spotify_link = next(
                (l for l in track.playback_links if l.platform == 'spotify'),
                None
            )
            if not spotify_link:
                continue

            try:
                sp_track = self.sp.track(spotify_link.deep_link)
                if sp_track and sp_track.get('album') and sp_track['album'].get('id'):
                    album_spotify_ids.add(sp_track['album']['id'])
            except Exception:
                continue

        print(f"   Found {len(album_spotify_ids)} unique albums to check for new artists")

        # Check each album for new artists
        for album_id in list(album_spotify_ids)[:50]:
            if discovered_count >= max_to_discover:
                break

            try:
                album = self.sp.album(album_id)

                if not album or not album.get('tracks'):
                    continue

                # Look at all artists on this album
                album_artists = set()
                for track in album['tracks']['items']:
                    for artist in track.get('artists', []):
                        if artist.get('id'):
                            album_artists.add(artist['id'])

                # For each artist on the album, check if they're new and folk
                for artist_id in album_artists:
                    if discovered_count >= max_to_discover:
                        break

                    # Skip if already crawled
                    existing_log = self.db.query(ArtistCrawlLog).filter(
                        ArtistCrawlLog.spotify_artist_id == artist_id
                    ).first()

                    if existing_log:
                        continue

                    # Skip if already in our database
                    existing_artist = self.db.query(Artist).filter(
                        Artist.spotify_id == artist_id
                    ).first()

                    if existing_artist:
                        continue

                    # Get artist details and check if Swedish/Nordic folk
                    try:
                        sp_artist = self.sp.artist(artist_id)
                        if self._evaluate_and_ingest(sp_artist):
                            discovered_count += 1
                            print(f"      Discovered from album: {album.get('name', 'Unknown')}")
                    except Exception as e:
                        print(f"      Error checking artist {artist_id}: {e}")
                        continue

            except Exception as e:
                print(f"      Error checking album {album_id}: {e}")
                continue

        return discovered_count

    def _evaluate_and_ingest(self, artist_obj: dict) -> bool:
        """
        Enhanced evaluation with:
        1. Rejection blocklist check
        2. Folk genre gatekeeper check
        3. Deduplication via ArtistCrawlLog
        4. Genre classification
        5. Manual verification check
        6. Full discography ingestion

        Returns True if artist was newly crawled.
        """
        artist_id = artist_obj['id']
        name = artist_obj['name']
        genres = artist_obj.get('genres', [])

        self.stats['artists_evaluated'] += 1

        # STEP 1: REJECTION CHECK
        rejected = self.db.query(RejectionLog).filter(
            RejectionLog.spotify_id == artist_id,
            RejectionLog.entity_type == 'artist'
        ).first()

        if rejected:
            self.stats['artists_rejected'] += 1
            print(f"      Skipping {name} (on rejection blocklist: {rejected.reason})")
            return False

        # STEP 2: CHECK EXISTING VERIFICATION STATUS
        existing_db_artist = self.db.query(Artist).filter(
            Artist.spotify_id == artist_id
        ).first()
        is_manually_verified = existing_db_artist and existing_db_artist.is_verified

        if is_manually_verified:
            print(f"      Artist '{name}' is Manually Verified. Bypassing gatekeeper.")
        else:
            # Only run strict gatekeeper if NOT verified
            is_folk = self.genre_classifier.is_folk_artist(genres, name)
            if not is_folk:
                return False

        self.stats['artists_passed_gatekeeper'] += 1

        # STEP 3: DEDUPLICATION
        existing_log = self.db.query(ArtistCrawlLog).filter(
            ArtistCrawlLog.spotify_artist_id == artist_id
        ).first()

        if existing_log:
            self.stats['artists_already_crawled'] += 1
            print(f"      Skipping {name} (already crawled on {existing_log.crawled_at.date()})")
            return False

        # STEP 4: GENRE CLASSIFICATION
        music_genre, confidence = self.genre_classifier.classify_artist_genre(
            name, genres, None
        )

        # STEP 5: CONFIDENCE CHECK
        if is_manually_verified:
            should_auto_approve = True
        else:
            AUTO_APPROVE_CONFIDENCE = 0.7
            name_lower = name.lower()
            traditional_keywords = ['spelmanslag', 'riksspelman', 'folkmusik', 'polska']
            has_strong_folk_signal = any(kw in name_lower for kw in traditional_keywords)

            should_auto_approve = confidence >= AUTO_APPROVE_CONFIDENCE or has_strong_folk_signal

        if not should_auto_approve:
            # Queue for manual approval
            print(f"      Queuing for approval: {name}")
            print(f"         Genres: {genres}")
            print(f"         Classified as: {music_genre} ({confidence:.2f} confidence)")

            try:
                existing_pending = self.db.query(PendingArtistApproval).filter(
                    PendingArtistApproval.spotify_id == artist_id
                ).first()

                if existing_pending:
                    print(f"         Already pending approval")
                    return False

                image_url = artist_obj.get('images', [{}])[0].get('url') if artist_obj.get('images') else None

                pending = PendingArtistApproval(
                    spotify_id=artist_id,
                    name=name,
                    image_url=image_url,
                    discovery_source='spider',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    genre_confidence=confidence,
                    status='pending'
                )

                self.db.add(pending)
                self.db.commit()

                print(f"         Added to approval queue")
                self.stats['artists_pending_approval'] = self.stats.get('artists_pending_approval', 0) + 1
                return False

            except IntegrityError:
                self.db.rollback()
                return False
            except Exception as e:
                print(f"         Error queueing for approval: {e}")
                self.db.rollback()
                return False

        # Auto-approved - proceed with ingestion
        if is_manually_verified:
            print(f"      Updating Verified Artist: {name}")
        else:
            print(f"      Auto-approved Folk Artist: {name}")

        print(f"         Genres: {genres}")
        print(f"         Classified as: {music_genre} ({confidence:.2f} confidence)")

        # STEP 6: INGEST FULL DISCOGRAPHY
        time.sleep(0.5)

        try:
            track_ids = self.ingestor.ingest_artist_albums(artist_id)

            # STEP 7: LOG THE CRAWL
            crawl_log = ArtistCrawlLog(
                spotify_artist_id=artist_id,
                artist_name=name,
                tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
                status='success',
                detected_genres=genres,
                music_genre_classification=music_genre,
                discovery_source='spider'
            )

            self.db.add(crawl_log)
            self.db.commit()

            # STEP 8: UPDATE TRACK GENRES
            tracks_updated = self.genre_classifier.classify_all_tracks_for_artist(artist_id)
            if tracks_updated > 0:
                print(f"         Tagged {tracks_updated} tracks as '{music_genre}'")

            self.stats['artists_crawled'] += 1
            self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids

            return True

        except IntegrityError:
            self.db.rollback()
            self.stats['artists_already_crawled'] += 1
            return False

        except Exception as e:
            print(f"         Error ingesting {name}: {e}")
            try:
                crawl_log = ArtistCrawlLog(
                    spotify_artist_id=artist_id,
                    artist_name=name,
                    tracks_found=0,
                    status='failed',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    discovery_source='spider'
                )
                self.db.add(crawl_log)
                self.db.commit()
            except Exception:
                self.db.rollback()

            return False

    def _print_stats(self, spider_name: str) -> None:
        """Print final statistics."""
        print("\n" + "="*60)
        print(f"[{spider_name}] Session Complete")
        print("="*60)
        print(f"Artists Evaluated:         {self.stats['artists_evaluated']}")
        print(f"Rejected (Blocklisted):    {self.stats['artists_rejected']}")
        print(f"Passed Gatekeeper:         {self.stats['artists_passed_gatekeeper']}")
        print(f"Already Crawled (Skipped): {self.stats['artists_already_crawled']}")
        print(f"New Artists Crawled:       {self.stats['artists_crawled']}")
        print(f"Total Tracks Found:        {self.stats['tracks_found']}")
        if 'artists_pending_approval' in self.stats:
            print(f"Pending Approval:          {self.stats['artists_pending_approval']}")
        print("="*60)
