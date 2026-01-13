#!/usr/bin/env python3
"""
Backfill spotify_id for existing albums by extracting from track playback links.
"""
import os
import sys
import re
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.models import Album, Track, TrackAlbum
from app.core.config import settings


def get_spotify_track_id_from_track(track):
    """Extract Spotify track ID from track's playback links."""
    if not track.playback_links:
        return None

    for link in track.playback_links:
        # Access attributes directly, not via get()
        if link.platform == 'spotify':
            deep_link = link.deep_link or ''

            # Check if it's just a raw Spotify ID (22 alphanumeric chars)
            if re.match(r'^[a-zA-Z0-9]{22}$', deep_link):
                return deep_link

            # Otherwise try to extract from URL patterns:
            # - https://open.spotify.com/track/TRACK_ID?si=...
            # - spotify:track:TRACK_ID
            track_match = re.search(r'(?:spotify:track:|/track/)([a-zA-Z0-9]+)', deep_link)
            if track_match:
                track_id = track_match.group(1)
                return track_id

    return None


def backfill_album_spotify_ids():
    """Main backfill function."""
    # Create database connection
    database_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}/{settings.POSTGRES_DB}"
    engine = create_engine(database_url)

    print("🔍 Starting album spotify_id backfill...")

    with Session(engine) as session:
        # Find all albums without spotify_id
        albums_without_spotify_id = session.query(Album).filter(
            Album.spotify_id.is_(None)
        ).all()

        print(f"📊 Found {len(albums_without_spotify_id)} albums without spotify_id")

        if not albums_without_spotify_id:
            print("✅ All albums already have spotify_id!")
            return

        # Initialize Spotify client
        try:
            import spotipy
            from spotipy.oauth2 import SpotifyClientCredentials

            client_credentials_manager = SpotifyClientCredentials(
                client_id=settings.SPOTIPY_CLIENT_ID,
                client_secret=settings.SPOTIPY_CLIENT_SECRET
            )
            sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)
        except Exception as e:
            print(f"❌ Failed to initialize Spotify client: {e}")
            return

        updated_count = 0
        skipped_count = 0
        error_count = 0

        for album in albums_without_spotify_id:
            print(f"\n🔍 Processing: {album.title} (ID: {album.id})")

            # Find tracks associated with this album
            track_albums = session.query(TrackAlbum).filter(
                TrackAlbum.album_id == album.id
            ).all()

            if not track_albums:
                print(f"  ⚠️  No tracks found for album")
                skipped_count += 1
                continue

            # Try to find Spotify album ID from any track
            spotify_album_id = None
            for track_album in track_albums:
                track = session.query(Track).filter(Track.id == track_album.track_id).first()
                if not track:
                    continue

                track_id = get_spotify_track_id_from_track(track)
                if track_id:
                    try:
                        # Fetch track info from Spotify to get album ID
                        track_info = sp.track(track_id)
                        if track_info and 'album' in track_info:
                            spotify_album_id = track_info['album']['id']
                            print(f"  ✓ Found Spotify album ID from track: {track.title}")
                            break
                    except Exception as e:
                        print(f"  ⚠️  Failed to fetch track from Spotify: {e}")
                        continue

            if spotify_album_id:
                # Update album with spotify_id
                try:
                    album.spotify_id = spotify_album_id
                    session.commit()
                    print(f"  ✅ Updated album with spotify_id: {spotify_album_id}")
                    updated_count += 1
                except Exception as e:
                    print(f"  ❌ Failed to update album: {e}")
                    session.rollback()
                    error_count += 1
            else:
                print(f"  ⚠️  Could not find Spotify album ID")
                skipped_count += 1

        print("\n" + "="*60)
        print("📊 Backfill Summary:")
        print(f"  ✅ Updated: {updated_count}")
        print(f"  ⚠️  Skipped: {skipped_count}")
        print(f"  ❌ Errors: {error_count}")
        print(f"  📈 Total processed: {len(albums_without_spotify_id)}")
        print("="*60)


if __name__ == "__main__":
    backfill_album_spotify_ids()
