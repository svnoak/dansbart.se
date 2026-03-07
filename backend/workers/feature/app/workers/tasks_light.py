"""
Light worker tasks - Discovery, ingestion, and maintenance.

These tasks handle I/O-bound operations like spider crawling,
Spotify API calls, and database cleanup. No ML processing.

MIT Licensed - No AGPL dependencies.
"""
import structlog
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.logging import canonical_bind

log = structlog.get_logger()


def _dispatch_audio_analysis(track_ids: list[str]) -> int:
    """
    Dispatch audio analysis tasks to the audio worker queue.

    Args:
        track_ids: List of track UUIDs to analyze

    Returns:
        Number of tasks dispatched
    """
    dispatched = 0
    for track_id in track_ids:
        celery_app.send_task(
            "app.workers.tasks_audio.analyze_track_task",
            args=[track_id],
            queue="audio"
        )
        dispatched += 1

    if dispatched > 0:
        log.info("dispatched_audio_tasks", count=dispatched)

    return dispatched


@celery_app.task(bind=True, acks_late=True, queue='light')
def spider_crawl_task(self, max_discoveries: int = 10):
    """
    Run the discovery spider to find new Swedish folk music artists.

    Uses search-based discovery to find artists matching Swedish/Nordic folk
    music keywords on Spotify.

    Args:
        max_discoveries: Maximum number of new artists to discover

    Returns:
        dict: Crawl statistics (artists found, tracks added, etc.)
    """
    log.info("starting_spider_crawl", max_discoveries=max_discoveries)

    db = SessionLocal()
    try:
        from app.workers.discovery.spider import DiscoverySpider

        spider = DiscoverySpider(db)
        stats = spider.crawl_by_search(max_discoveries=max_discoveries)
        canonical_bind(artists_crawled=stats.get('artists_crawled', 0))

        return {
            "status": "success",
            "message": f"Spider crawl complete. Found {stats['artists_crawled']} new artists.",
            "stats": stats
        }
    except Exception as e:
        log.error("spider_crawl_failed", exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


def _backfill_artist(artist_spotify_id: str = None, max_artists: int = 20) -> dict:
    """Helper function to backfill artist (used by both task and direct call)."""
    log.info("backfilling_artists", artist_spotify_id=artist_spotify_id)

    db = SessionLocal()
    try:
        from app.workers.discovery.spider import DiscoverySpider

        spider = DiscoverySpider(db)

        if artist_spotify_id:
            # Backfill specific artist
            from app.workers.ingestion.spotify import SpotifyIngestor
            from app.core.models import ArtistCrawlLog
            from app.services.genre_classifier import GenreClassifier

            ingestor = SpotifyIngestor(db)
            genre_classifier = GenreClassifier(db)

            # Get artist info from Spotify
            sp_artist = ingestor.sp.artist(artist_spotify_id)
            artist_name = sp_artist.get('name', 'Unknown')
            genres = sp_artist.get('genres', [])

            log.info("backfilling_specific_artist", artist_name=artist_name)

            # Classify genre
            music_genre, confidence = genre_classifier.classify_artist_genre(
                artist_name, genres, None
            )

            # Ingest discography
            track_ids = ingestor.ingest_artist_albums(artist_spotify_id)

            # Dispatch audio analysis for new tracks
            dispatched = _dispatch_audio_analysis(track_ids)

            # Log the crawl
            crawl_log = ArtistCrawlLog(
                spotify_artist_id=artist_spotify_id,
                artist_name=artist_name,
                tracks_found=len(track_ids),
                status='success',
                detected_genres=genres,
                music_genre_classification=music_genre,
                discovery_source='backfill_specific'
            )
            db.add(crawl_log)
            db.commit()

            # Update track genres
            tracks_updated = genre_classifier.classify_all_tracks_for_artist(artist_spotify_id)

            return {
                "status": "success",
                "message": f"Backfilled artist '{artist_name}'. Found {len(track_ids)} tracks, {dispatched} queued for analysis.",
                "artist_name": artist_name,
                "tracks_found": len(track_ids),
                "tracks_queued": dispatched,
                "tracks_tagged": tracks_updated,
                "genre": music_genre
            }
        else:
            # Backfill existing artists in database
            stats = spider.backfill_existing_artists(
                max_artists=max_artists,
                discover_from_albums=True
            )

            return {
                "status": "success",
                "message": f"Backfill complete. Processed {stats['artists_crawled']} artists.",
                "stats": stats
            }
    except Exception as e:
        log.error("backfill_failed", exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


@celery_app.task(bind=True, acks_late=True, queue='light')
def backfill_artist_task(self, artist_spotify_id: str = None, max_artists: int = 20):
    """
    Backfill all tracks for artists from Spotify.

    If artist_spotify_id is provided, backfill only that artist.
    Otherwise, backfill existing artists in the database.

    Args:
        artist_spotify_id: Optional Spotify ID of specific artist to backfill
        max_artists: Maximum number of artists to backfill (if not specific artist)

    Returns:
        dict: Backfill statistics
    """
    return _backfill_artist(artist_spotify_id, max_artists)


@celery_app.task(bind=True, acks_late=True, queue='light')
def spotify_ingest_task(self, resource_type: str, spotify_id: str):
    """
    Ingest a Spotify resource (playlist, album, artist, or single track).
    Dispatched by the Java API; routes to the appropriate ingestion method.

    Args:
        resource_type: One of 'playlist', 'album', 'artist', 'track'
        spotify_id: Spotify ID of the playlist, album, artist, or track

    Returns:
        dict: Ingestion result with status and counts
    """
    log.info("spotify_ingest", resource_type=resource_type,
             spotify_id=spotify_id)
    resource_type = (resource_type or "playlist").lower().strip()

    # Call the task functions directly to avoid deadlock with --pool=solo
    # (Using .apply().get() would block waiting for a subtask that can't run)
    if resource_type == "playlist":
        return _ingest_playlist(spotify_id)
    if resource_type == "album":
        return _ingest_album(spotify_id)
    if resource_type == "artist":
        return _backfill_artist(spotify_id)
    if resource_type == "track":
        return _ingest_track(spotify_id)

    return {
        "status": "failed",
        "message": f"Invalid resource_type: {resource_type}. Must be playlist, album, artist, or track."
    }


def _ingest_track(spotify_track_id: str) -> dict:
    """Helper function to ingest a single track by Spotify ID (used by spotify_ingest_task)."""
    log.info("ingesting_track", spotify_track_id=spotify_track_id)

    db = SessionLocal()
    try:
        from app.workers.ingestion.spotify import SpotifyIngestor

        ingestor = SpotifyIngestor(db)
        track_data = ingestor.sp.track(spotify_track_id)
        if not track_data:
            return {
                "status": "failed",
                "message": f"Track not found on Spotify: {spotify_track_id}"
            }

        pending_ids = ingestor.ingest_tracks_from_list([track_data])
        dispatched = _dispatch_audio_analysis(pending_ids)

        return {
            "status": "success",
            "message": f"Ingested track. {dispatched} track(s) queued for analysis.",
            "tracks_queued": dispatched
        }
    except Exception as e:
        log.error("track_ingestion_failed", spotify_track_id=spotify_track_id,
                  exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


def _ingest_playlist(playlist_id: str) -> dict:
    """Helper function to ingest a playlist (used by both task and direct call)."""
    log.info("ingesting_playlist", playlist_id=playlist_id)

    db = SessionLocal()
    try:
        from app.workers.ingestion.spotify import SpotifyIngestor

        ingestor = SpotifyIngestor(db)
        track_ids = ingestor.ingest_playlist(playlist_id)

        # Dispatch audio analysis for new tracks
        dispatched = _dispatch_audio_analysis(track_ids)

        return {
            "status": "success",
            "message": f"Ingested playlist. {dispatched} new tracks queued for analysis.",
            "tracks_queued": dispatched
        }
    except Exception as e:
        log.error("playlist_ingestion_failed", playlist_id=playlist_id,
                  exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


@celery_app.task(bind=True, acks_late=True, queue='light')
def ingest_playlist_task(self, playlist_id: str):
    """
    Ingest all tracks from a Spotify playlist.

    Args:
        playlist_id: Spotify playlist ID

    Returns:
        dict: Ingestion statistics
    """
    return _ingest_playlist(playlist_id)


def _ingest_album(album_id: str) -> dict:
    """Helper function to ingest an album (used by both task and direct call)."""
    log.info("ingesting_album", album_id=album_id)

    db = SessionLocal()
    try:
        from app.workers.ingestion.spotify import SpotifyIngestor

        ingestor = SpotifyIngestor(db)
        track_ids = ingestor.ingest_album(album_id)

        # Dispatch audio analysis for new tracks
        dispatched = _dispatch_audio_analysis(track_ids)

        return {
            "status": "success",
            "message": f"Ingested album. {dispatched} new tracks queued for analysis.",
            "tracks_queued": dispatched
        }
    except Exception as e:
        log.error("album_ingestion_failed", album_id=album_id, exc_info=True)
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


@celery_app.task(bind=True, acks_late=True, queue='light')
def ingest_album_task(self, album_id: str):
    """
    Ingest all tracks from a Spotify album.

    Args:
        album_id: Spotify album ID

    Returns:
        dict: Ingestion statistics
    """
    return _ingest_album(album_id)


@celery_app.task(bind=True, acks_late=True, queue='light')
def backfill_duration_task(self, batch_size: int = 200):
    """
    Backfill duration_ms for tracks where it is 0 or NULL.

    Fetches duration from Spotify API using existing playback links.

    Args:
        batch_size: Max number of tracks to process per run

    Returns:
        dict: Backfill statistics
    """
    log.info("starting_duration_backfill", batch_size=batch_size)

    db = SessionLocal()
    try:
        from app.core.models import Track, PlaybackLink
        from app.workers.ingestion.spotify import SpotifyIngestor
        from sqlalchemy import or_

        ingestor = SpotifyIngestor(db)

        # Find tracks with missing duration that have a Spotify link
        rows = (
            db.query(Track.id, PlaybackLink.deep_link)
            .join(PlaybackLink, PlaybackLink.track_id == Track.id)
            .filter(PlaybackLink.platform == "spotify")
            .filter(or_(Track.duration_ms == None, Track.duration_ms == 0))
            .limit(batch_size)
            .all()
        )

        if not rows:
            return {"status": "success", "message": "No tracks need duration backfill.", "updated": 0}

        # Batch fetch from Spotify (up to 50 at a time)
        updated = 0
        spotify_ids = [r.deep_link for r in rows]
        track_id_by_spotify = {r.deep_link: r.id for r in rows}

        for i in range(0, len(spotify_ids), 50):
            batch = spotify_ids[i:i + 50]
            try:
                response = ingestor.sp.tracks(batch)
                for sp_track in (response.get('tracks') or []):
                    if not sp_track:
                        continue
                    sp_id = sp_track['id']
                    duration_ms = sp_track.get('duration_ms')
                    if duration_ms and sp_id in track_id_by_spotify:
                        track = db.query(Track).get(track_id_by_spotify[sp_id])
                        if track:
                            track.duration_ms = duration_ms
                            updated += 1
            except Exception as e:
                log.error("duration_batch_fetch_failed", error=str(e))

        db.commit()
        log.info("duration_backfill_complete", updated=updated, total=len(rows))

        return {
            "status": "success",
            "message": f"Updated duration for {updated}/{len(rows)} tracks.",
            "updated": updated,
            "total_candidates": len(rows)
        }
    except Exception as e:
        log.error("duration_backfill_failed", exc_info=True)
        db.rollback()
        return {"status": "failed", "message": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True, acks_late=True, queue='light')
def cleanup_orphans_task(self):
    """
    Clean up orphaned tracks and broken links.

    Removes:
    - Tracks without any playback links
    - Playback links marked as not working
    - Orphaned album/artist links

    Returns:
        dict: Cleanup statistics
    """
    log.info("starting_orphan_cleanup")

    db = SessionLocal()
    try:
        from app.core.models import Track, PlaybackLink, TrackArtist, TrackAlbum
        from sqlalchemy import and_

        stats = {
            'broken_links_removed': 0,
            'orphan_tracks_removed': 0,
            'orphan_artist_links_removed': 0,
            'orphan_album_links_removed': 0
        }

        # Remove broken playback links
        broken_links = db.query(PlaybackLink).filter(
            PlaybackLink.is_working == False
        ).all()

        for link in broken_links:
            db.delete(link)
            stats['broken_links_removed'] += 1

        db.commit()

        # Find and remove tracks without any playback links
        orphan_tracks = db.query(Track).filter(
            ~Track.playback_links.any()
        ).all()

        for track in orphan_tracks:
            # Remove related links first
            db.query(TrackArtist).filter(TrackArtist.track_id == track.id).delete()
            db.query(TrackAlbum).filter(TrackAlbum.track_id == track.id).delete()
            db.delete(track)
            stats['orphan_tracks_removed'] += 1

        db.commit()

        log.info("cleanup_complete", **stats)

        return {
            "status": "success",
            "message": "Cleanup complete",
            "stats": stats
        }
    except Exception as e:
        log.error("cleanup_failed", exc_info=True)
        db.rollback()
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()
