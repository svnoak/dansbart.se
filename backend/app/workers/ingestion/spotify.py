import os
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.core.config import settings

class SpotifyIngestor:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TrackRepository(db)
        
        client_credentials_manager = SpotifyClientCredentials(
            client_id=settings.SPOTIPY_CLIENT_ID,
            client_secret=settings.SPOTIPY_CLIENT_SECRET
        )
        self.sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

    def ingest_playlist(self, playlist_id: str):
        print(f"🎸 Starting ingestion for playlist: {playlist_id}")
        try:
            results = self.sp.playlist_tracks(playlist_id)
        except Exception as e:
            print(f"❌ Error connecting to Spotify: {e}")
            return

        total_processed = 0
        while results:
            raw_items = [item.get('track') for item in results['items']]
            total_processed += self.ingest_tracks_from_list(raw_items)

            if results['next']:
                results = self.sp.next(results)
            else:
                results = None
        
        print(f"✅ Finished! Processed {total_processed} tracks.")

    def ingest_tracks_from_list(self, track_items: list):
        """Reusable method to save a list of Spotify Track Objects"""
        count = 0
        for track in track_items:
            if not track or track.get('is_local'):
                continue
            try:
                self._process_single_track(track)
                count += 1
            except Exception as e:
                print(f"⚠️ Error: {e}")
        return count

    # --- NEW: Full Discography Ingestion ---
    def ingest_artist_albums(self, artist_id: str):
        print(f"📦 Fetching discography for artist...")
        
        # 1. Get all albums (Albums + Singles)
        albums = []
        # limit=50 is max per page
        results = self.sp.artist_albums(artist_id, album_type='album,single', country='SE', limit=50)
        
        while results:
            albums.extend(results['items'])
            if results['next']:
                results = self.sp.next(results)
            else:
                results = None
                
        print(f"   Found {len(albums)} releases. Fetching tracks...")

        # 2. Loop through every album to get tracks
        total_tracks = 0
        for album in albums:
            try:
                album_tracks_results = self.sp.album_tracks(album['id'])
                
                tracks_to_save = []
                while album_tracks_results:
                    for track in album_tracks_results['items']:
                        # CRITICAL: The album_tracks endpoint does NOT return the album object inside the track.
                        # We must manually inject it so _process_single_track can read 'album_name'.
                        track['album'] = album 
                        tracks_to_save.append(track)
                        
                    if album_tracks_results['next']:
                        album_tracks_results = self.sp.next(album_tracks_results)
                    else:
                        album_tracks_results = None
                
                # Batch save this album
                count = self.ingest_tracks_from_list(tracks_to_save)
                total_tracks += count
                
            except Exception as e:
                print(f"⚠️ Error processing album '{album['name']}': {e}")

        print(f"⬇️ Ingested {total_tracks} tracks from full discography.")
    # ---------------------------------------

    def _process_single_track(self, sp_track: dict):
        external_ids = sp_track.get('external_ids', {})
        isrc = external_ids.get('isrc')
        title = sp_track.get('name')
        
        album_obj = sp_track.get('album', {})
        album_name = album_obj.get('name')
        
        artists = sp_track.get('artists', [])
        artist_name = artists[0]['name'] if artists else "Unknown Artist"
        
        external_urls = sp_track.get('external_urls', {})
        spotify_url = external_urls.get('spotify')

        if not isrc:
            return

        db_track = self.repo.get_by_isrc(isrc)

        if not db_track:
            print(f"✨ New Track: {title} - {album_name}")
            db_track = self.repo.create_track(
                title=title, 
                artist=artist_name, 
                isrc=isrc,
                album=album_name
            )
        else:
            # Update Album if missing
            if not db_track.album_name and album_name:
                print(f"📝 Updating Album: {title} -> {album_name}")
                self.repo.update_album(db_track, album_name)

        if spotify_url:
            self.repo.add_playback_link(
                track_id=db_track.id, 
                platform="spotify", 
                url=spotify_url
            )