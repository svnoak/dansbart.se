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
            print(f"❌ Error: {e}")
            return []

        processed_ids = []

        while results:
            raw_items = [item.get('track') for item in results['items']]
            
            # Helper returns IDs now
            batch_ids = self.ingest_tracks_from_list(raw_items) 
            processed_ids.extend(batch_ids)

            if results['next']:
                results = self.sp.next(results)
            else:
                results = None
        
        print(f"✅ Ingestion complete. {len(processed_ids)} tracks ready for analysis.")
        return processed_ids

    def ingest_tracks_from_list(self, track_items: list) -> list[str]:
        """Returns list of track IDs saved"""
        saved_ids = []
        for track in track_items:
            if not track or track.get('is_local'): continue
            
            try:
                # _process_single_track now returns the DB object
                db_track = self._process_single_track(track)
                if db_track:
                    saved_ids.append(str(db_track.id))
            except Exception as e:
                print(f"⚠️ Error: {e}")
        return saved_ids

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
        duration_ms = sp_track.get('duration_ms') 
        
        if not isrc:
            return

        # --- 1. EXTRACT RICH DATA ---
        
        # Album Info
        album_obj = sp_track.get('album', {})
        album_images = album_obj.get('images', [])
        cover_url = album_images[0]['url'] if album_images else None
        
        album_data = {
            'name': album_obj.get('name'),
            'cover': cover_url,
            'date': album_obj.get('release_date')
        }

        # Artists Info (List of dicts)
        artists_data = []
        for artist in sp_track.get('artists', []):
            artists_data.append({
                'name': artist['name'],
                'id': artist['id'] # Spotify ID
            })

        # --- 2. DATABASE INTERACTION ---
        db_track = self.repo.get_by_isrc(isrc)

        if not db_track:
            print(f"✨ New Track: {title}")
            db_track = self.repo.create_track(
                title=title, 
                isrc=isrc,
                duration_ms=duration_ms,
                album_data=album_data,
                artists_data=artists_data
            )
        else:
            if not db_track.duration_ms and duration_ms:
                db_track.duration_ms = duration_ms
                self.db.commit()

        # Link Spotify ID (extract from URL or use track ID directly)
        spotify_id = sp_track.get('id')  # Spotify track ID is directly available
        if spotify_id:
            self.repo.add_playback_link(
                track_id=db_track.id, 
                platform="spotify", 
                url=spotify_id  # Store just the ID, not the full URL
            )

        return db_track