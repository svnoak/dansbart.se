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

import structlog

from app.core.celery_app import celery_app
from app.core.logging import canonical_bind
from app.workers.ingestion.spotify import SpotifyIngestor
from app.repository.track import TrackRepository
from app.core.models import (
    Track, Artist, Album, TrackAlbum,
    ArtistCrawlLog, RejectionLog, PendingArtistApproval
)
from app.services.genre_classifier import GenreClassifier

log = structlog.get_logger()


def _dispatch_audio_analysis(track_ids: list[str]) -> int:
    """Dispatch audio analysis tasks to the audio worker queue."""
    dispatched = 0
    for track_id in track_ids:
        celery_app.send_task(
            "app.workers.tasks_audio.analyze_track_task",
            args=[track_id],
            queue="audio"
        )
        dispatched += 1
    return dispatched


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
        log.info("starting_search_mode", max_discoveries=max_discoveries)

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
                log.info("max_discoveries_reached", max_discoveries=max_discoveries)
                break

            log.info("searching", query=query)

            try:
                results = self.sp.search(q=query, type='artist', limit=20)

                if not results.get('artists', {}).get('items'):
                    log.info("search_no_results", query=query)
                    continue

                for artist in results['artists']['items']:
                    if discovered_count >= max_discoveries:
                        break

                    if self._evaluate_and_ingest(artist):
                        discovered_count += 1

            except Exception as e:
                log.error("search_error", query=query, error=str(e))

        self._log_stats("Search Spider")
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
        log.info(
            "starting_backfill_mode",
            max_artists=max_artists,
            discover_from_albums=discover_from_albums,
        )

        # Get all artists in our database that have a Spotify ID
        artists = self.db.query(Artist).filter(
            Artist.spotify_id.isnot(None)
        ).limit(max_artists * 2).all()

        if not artists:
            log.warn("no_artists_found", reason="no artists with Spotify IDs in database")
            return self.stats

        log.info("artists_loaded_from_db", count=len(artists))

        backfilled_count = 0

        for artist in artists:
            if backfilled_count >= max_artists:
                log.info("max_backfill_reached", max_artists=max_artists)
                break

            artist_id = artist.spotify_id
            artist_name = artist.name

            # Check if already crawled
            existing_log = self.db.query(ArtistCrawlLog).filter(
                ArtistCrawlLog.spotify_artist_id == artist_id
            ).first()

            if existing_log:
                self.stats['artists_already_crawled'] += 1
                log.debug(
                    "artist_already_crawled",
                    artist_name=artist_name,
                    crawled_at=str(existing_log.crawled_at.date()),
                )
                continue

            log.info("backfilling_artist", artist_name=artist_name)

            try:
                # Get artist details from Spotify for genre info
                sp_artist = self.sp.artist(artist_id)
                genres = sp_artist.get('genres', [])

                # Classify the artist's genre
                music_genre, confidence = self.genre_classifier.classify_artist_genre(
                    artist_name, genres, None
                )

                log.info(
                    "artist_genre_classified",
                    artist_name=artist_name,
                    music_genre=music_genre,
                    confidence=round(confidence, 2),
                )

                # Ingest full discography
                track_ids = self.ingestor.ingest_artist_albums(artist_id)

                # Dispatch audio analysis for new tracks
                if track_ids:
                    dispatched = _dispatch_audio_analysis(track_ids)
                    log.info(
                        "audio_analysis_dispatched",
                        artist_name=artist_name,
                        dispatched=dispatched,
                    )

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
                    log.info(
                        "tracks_tagged",
                        artist_name=artist_name,
                        tracks_updated=tracks_updated,
                        music_genre=music_genre,
                    )

                self.stats['artists_crawled'] += 1
                self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids
                backfilled_count += 1

            except Exception as e:
                log.error("backfill_error", artist_name=artist_name, error=str(e))

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
            log.info("starting_album_discovery_phase")
            discovered_from_albums = self._discover_artists_from_albums(
                max_artists - backfilled_count
            )
            log.info("album_discovery_complete", discovered=discovered_from_albums)

        self._log_stats("Backfill Spider")
        return self.stats

    def _discover_artists_from_albums(self, max_to_discover: int) -> int:
        """
        Discover new Swedish/Nordic folk artists from albums in our database.

        Strategy: Look at albums featuring our existing artists and discover
        other artists on those albums (compilations, collaborations, etc.)
        """
        if max_to_discover <= 0:
            log.info("album_discovery_skipped", reason="max discoveries limit reached")
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

        log.info("albums_to_check", count=len(album_spotify_ids))

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
                            log.info(
                                "discovered_from_album",
                                artist_name=sp_artist.get('name', 'Unknown'),
                                album_name=album.get('name', 'Unknown'),
                            )
                    except Exception as e:
                        log.error(
                            "artist_check_error",
                            artist_id=artist_id,
                            error=str(e),
                        )
                        continue

            except Exception as e:
                log.error("album_check_error", album_id=album_id, error=str(e))
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
            log.info(
                "artist_rejected",
                artist_name=name,
                reason=rejected.reason,
            )
            return False

        # STEP 2: CHECK EXISTING VERIFICATION STATUS
        existing_db_artist = self.db.query(Artist).filter(
            Artist.spotify_id == artist_id
        ).first()
        is_manually_verified = existing_db_artist and existing_db_artist.is_verified

        if is_manually_verified:
            log.info("artist_verified_bypass", artist_name=name)
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
            log.debug(
                "artist_already_crawled",
                artist_name=name,
                crawled_at=str(existing_log.crawled_at.date()),
            )
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
            log.info(
                "queuing_for_approval",
                artist_name=name,
                genres=genres,
                music_genre=music_genre,
                confidence=round(confidence, 2),
            )

            try:
                existing_pending = self.db.query(PendingArtistApproval).filter(
                    PendingArtistApproval.spotify_id == artist_id
                ).first()

                if existing_pending:
                    log.debug("already_pending_approval", artist_name=name)
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

                log.info("added_to_approval_queue", artist_name=name)
                self.stats['artists_pending_approval'] = self.stats.get('artists_pending_approval', 0) + 1
                return False

            except IntegrityError:
                self.db.rollback()
                return False
            except Exception as e:
                log.error("approval_queue_error", artist_name=name, error=str(e))
                self.db.rollback()
                return False

        # Auto-approved - proceed with ingestion
        if is_manually_verified:
            log.info(
                "ingesting_verified_artist",
                artist_name=name,
                genres=genres,
                music_genre=music_genre,
                confidence=round(confidence, 2),
            )
        else:
            log.info(
                "ingesting_auto_approved_artist",
                artist_name=name,
                genres=genres,
                music_genre=music_genre,
                confidence=round(confidence, 2),
            )

        # STEP 6: INGEST FULL DISCOGRAPHY
        time.sleep(0.5)

        try:
            track_ids = self.ingestor.ingest_artist_albums(artist_id)

            # Dispatch audio analysis for new tracks
            if track_ids:
                dispatched = _dispatch_audio_analysis(track_ids)
                log.info(
                    "audio_analysis_dispatched",
                    artist_name=name,
                    dispatched=dispatched,
                )

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
                log.info(
                    "tracks_tagged",
                    artist_name=name,
                    tracks_updated=tracks_updated,
                    music_genre=music_genre,
                )

            self.stats['artists_crawled'] += 1
            self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids

            return True

        except IntegrityError:
            self.db.rollback()
            self.stats['artists_already_crawled'] += 1
            return False

        except Exception as e:
            log.error("ingestion_error", artist_name=name, error=str(e))
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

    def _log_stats(self, spider_name: str) -> None:
        """Log final statistics as a structured log event."""
        stats_kwargs = dict(
            spider_name=spider_name,
            artists_evaluated=self.stats['artists_evaluated'],
            artists_rejected=self.stats['artists_rejected'],
            artists_passed_gatekeeper=self.stats['artists_passed_gatekeeper'],
            artists_already_crawled=self.stats['artists_already_crawled'],
            artists_crawled=self.stats['artists_crawled'],
            tracks_found=self.stats['tracks_found'],
        )

        if 'artists_pending_approval' in self.stats:
            stats_kwargs['artists_pending_approval'] = self.stats['artists_pending_approval']

        log.info("session_complete", **stats_kwargs)

        canonical_bind(
            spider_name=spider_name,
            artists_evaluated=self.stats['artists_evaluated'],
            artists_crawled=self.stats['artists_crawled'],
            tracks_found=self.stats['tracks_found'],
        )
