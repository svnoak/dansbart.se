"""
Light worker tasks - Discovery, ingestion, and maintenance.

These tasks handle I/O-bound operations like spider crawling,
Spotify API calls, and database cleanup. No ML processing.

MIT Licensed - No AGPL dependencies.
"""
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal


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
        print(f"[Light Worker] Dispatched {dispatched} tracks to audio queue")

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
    print(f"[Light Worker] Starting spider crawl (max_discoveries={max_discoveries})...")

    db = SessionLocal()
    try:
        from app.workers.discovery.spider import DiscoverySpider

        spider = DiscoverySpider(db)
        stats = spider.crawl_by_search(max_discoveries=max_discoveries)

        return {
            "status": "success",
            "message": f"Spider crawl complete. Found {stats['artists_crawled']} new artists.",
            "stats": stats
        }
    except Exception as e:
        print(f"[Light Worker] Spider crawl failed: {e}")
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()


def _backfill_artist(artist_spotify_id: str = None, max_artists: int = 20) -> dict:
    """Helper function to backfill artist (used by both task and direct call)."""
    print(f"[Light Worker] Backfilling artists...")

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

            print(f"   Backfilling specific artist: {artist_name}")

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
        print(f"[Light Worker] Backfill failed: {e}")
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
    Ingest a Spotify resource (playlist, album, or artist).
    Dispatched by the Java API; routes to the appropriate ingestion method.

    Args:
        resource_type: One of 'playlist', 'album', 'artist'
        spotify_id: Spotify ID of the playlist, album, or artist

    Returns:
        dict: Ingestion result with status and counts
    """
    print(f"[Light Worker] Spotify ingest: {resource_type} {spotify_id}...")
    resource_type = (resource_type or "playlist").lower().strip()

    # Call the task functions directly to avoid deadlock with --pool=solo
    # (Using .apply().get() would block waiting for a subtask that can't run)
    if resource_type == "playlist":
        return _ingest_playlist(spotify_id)
    if resource_type == "album":
        return _ingest_album(spotify_id)
    if resource_type == "artist":
        return _backfill_artist(spotify_id)

    return {
        "status": "failed",
        "message": f"Invalid resource_type: {resource_type}. Must be playlist, album, or artist."
    }


def _ingest_playlist(playlist_id: str) -> dict:
    """Helper function to ingest a playlist (used by both task and direct call)."""
    print(f"[Light Worker] Ingesting playlist {playlist_id}...")

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
        print(f"[Light Worker] Playlist ingestion failed: {e}")
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
    print(f"[Light Worker] Ingesting album {album_id}...")

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
        print(f"[Light Worker] Album ingestion failed: {e}")
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
    print("[Light Worker] Running orphan cleanup...")

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

        print(f"[Light Worker] Cleanup complete: {stats}")

        return {
            "status": "success",
            "message": "Cleanup complete",
            "stats": stats
        }
    except Exception as e:
        print(f"[Light Worker] Cleanup failed: {e}")
        db.rollback()
        return {
            "status": "failed",
            "message": str(e)
        }
    finally:
        db.close()
