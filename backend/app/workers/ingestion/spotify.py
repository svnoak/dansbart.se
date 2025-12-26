import time
from sqlalchemy.orm import Session
from app.repository.track import TrackRepository
from app.core.config import settings

class SpotifyIngestor:
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
        
        print(f"✅ Ingestion complete. {len(processed_ids)} tracks queued for analysis.")
        return processed_ids

    def ingest_tracks_from_list(self, track_items: list) -> list[str]:
        """
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
                track_map[track_id] = track  # Keep original track data for album info

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

                        # If original track has album data injected, preserve it
                        if 'album' in original_track and original_track['album']:
                            full_track['album'] = original_track['album']

                        full_tracks.append(full_track)

            except Exception as e:
                print(f"⚠️ Error fetching track details batch: {e}")
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
                # _process_single_track now returns the DB object (or None if failed)
                db_track = self._process_single_track(track)
                if db_track:
                    # Only queue for analysis if not already processed
                    if db_track.processing_status == "PENDING":
                        pending_ids.append(str(db_track.id))
                    else:
                        skipped_count += 1
            except Exception as e:
                print(f"⚠️ Error processing track: {e}")

        if skipped_count > 0:
            print(f"   ⏭️ Skipped {skipped_count} tracks (already processed)")

        return pending_ids

    # --- NEW: Album Ingestion ---
    def ingest_album(self, album_id: str):
        """Ingest all tracks from a single album"""
        print(f"💿 Fetching album: {album_id}")

        try:
            # Get album details
            album = self.sp.album(album_id)
            album_name = album.get('name', 'Unknown')
            print(f"   Album: {album_name}")

            # Get all tracks from the album
            tracks_to_save = []
            album_tracks_results = self.sp.album_tracks(album_id)

            while album_tracks_results:
                for track in album_tracks_results['items']:
                    # Inject album object so _process_single_track can read album info
                    track['album'] = album
                    tracks_to_save.append(track)

                if album_tracks_results['next']:
                    album_tracks_results = self.sp.next(album_tracks_results)
                else:
                    album_tracks_results = None

            # Process all tracks
            pending_ids = self.ingest_tracks_from_list(tracks_to_save)
            print(f"✅ Album ingestion complete. {len(pending_ids)} tracks queued for analysis.")
            return pending_ids

        except Exception as e:
            print(f"❌ Error ingesting album: {e}")
            return []

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
        # Note: spotipy handles rate limit retries automatically using Retry-After header
        all_pending_ids = []
        for idx, album in enumerate(albums):
            try:
                # Gentle pacing: Small delay every 10 albums to spread load over 30s window
                if idx > 0 and idx % 10 == 0:
                    time.sleep(1.0)  # 1 second pause every 10 albums

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

                # Batch save this album - returns only PENDING track IDs
                pending_ids = self.ingest_tracks_from_list(tracks_to_save)
                all_pending_ids.extend(pending_ids)

            except Exception as e:
                print(f"⚠️ Error processing album '{album['name']}': {e}")

        print(f"⬇️ Ingested discography. {len(all_pending_ids)} new tracks queued for analysis.")
        return all_pending_ids
    # ---------------------------------------

    def _process_single_track(self, sp_track: dict):
        import hashlib

        external_ids = sp_track.get('external_ids', {})
        isrc = external_ids.get('isrc')
        title = sp_track.get('name')
        duration_ms = sp_track.get('duration_ms')

        # If no ISRC, generate a fallback identifier from track metadata
        if not isrc:
            # Create a stable hash from: track name + first artist + album + duration
            album_obj = sp_track.get('album', {})
            album_name = album_obj.get('name', '')
            artists = sp_track.get('artists', [])
            first_artist = artists[0]['name'] if artists else ''

            # Normalize and create hash
            hash_input = f"{title}|{first_artist}|{album_name}|{duration_ms}".lower()
            hash_digest = hashlib.md5(hash_input.encode()).hexdigest()
            isrc = f"FALLBACK-{hash_digest[:12]}"  # Use first 12 chars of MD5
            print(f"   ⚠️  No ISRC for '{title}' - using fallback: {isrc}")

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
            # Track exists - update missing data and add new album link if needed
            updated = False

            # Update duration if missing
            if not db_track.duration_ms and duration_ms:
                db_track.duration_ms = duration_ms
                updated = True

            # Add new album link if this track appears in a new album
            if album_data and album_data.get('name'):
                from app.core.models import Album, TrackAlbum

                # Get or create the album
                primary_artist_data = artists_data[0] if artists_data else None
                if primary_artist_data:
                    primary_artist = self.repo.get_or_create_artist(
                        primary_artist_data['name'],
                        primary_artist_data.get('id')
                    )

                    # Check if album exists
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
                            release_date=album_data.get('date')
                        )
                        self.db.add(album)
                        self.db.flush()

                    # Check if track is already linked to this album
                    existing_link = self.db.query(TrackAlbum).filter(
                        TrackAlbum.track_id == db_track.id,
                        TrackAlbum.album_id == album.id
                    ).first()

                    if not existing_link:
                        # Add new album link
                        self.db.add(TrackAlbum(
                            track_id=db_track.id,
                            album_id=album.id
                        ))
                        print(f"   📀 Added album link: '{title}' -> '{album_data['name']}'")
                        updated = True

            if updated:
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