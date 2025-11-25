import random
from sqlalchemy.orm import Session
from app.workers.ingestion.spotify import SpotifyIngestor
from app.repository.track import TrackRepository
from app.core.models import Track

# The "Gatekeeper" Whitelist
# An artist MUST have at least one of these genres (or partial match) to be crawled.
VALID_GENRES = [
    "swedish folk", "nordic folk", "scandinavian folk", "spelmanslag", 
    "nyckelharpa", "folkmusik", "polska", "svensk folkmusik", "fiddle",
    "dalarna", "hälsingland", "uppland", "västerbotten"
]

class DiscoverySpider:
    def __init__(self, db: Session):
        self.db = db
        self.ingestor = SpotifyIngestor(db)
        self.repo = TrackRepository(db)
        # Reuse the Spotify client from the ingestor to share connection/auth
        self.sp = self.ingestor.sp 

    def crawl_related_artists(self, seed_limit=1):
        """
        1. Pick a random artist from our DB.
        2. Ask Spotify for 'Related Artists'.
        3. Filter for Folk genres.
        4. Ingest their FULL discography.
        """
        print("🕸️  Spider waking up...")
        
        # Get all tracks to find potential seeds
        db_tracks = self.db.query(Track).all()
        
        if not db_tracks:
            print("❌ No seeds found! You must ingest at least one playlist first.")
            return

        # Try 'seed_limit' times to find a valid artist chain
        for _ in range(seed_limit):
            seed_track = random.choice(db_tracks)
            self._process_seed(seed_track)

    def _process_seed(self, db_track):
        # Find a valid Spotify link for this track to get the Artist ID
        playback_link = next((l for l in db_track.playback_links if l.platform == 'spotify'), None)
        
        if not playback_link:
            return

        try:
            # Fetch track details from Spotify API
            # We need this because our DB currently stores Artist Name, not Artist ID.
            sp_track = self.sp.track(playback_link.deep_link)
            
            if not sp_track or not sp_track['artists']:
                return

            artist_id = sp_track['artists'][0]['id']
            artist_name = sp_track['artists'][0]['name']
            
            print(f"🕷️  Seeding from artist: {artist_name}")
            
            # Get Related Artists (The "Social Graph")
            related = self.sp.artist_related_artists(artist_id)
            
            found_count = 0
            for artist in related['artists']:
                if self._evaluate_and_ingest(artist):
                    found_count += 1
            
            if found_count == 0:
                print(f"   (No new valid folk artists found related to {artist_name})")
                
        except Exception as e:
            print(f"⚠️  Spider error processing seed '{db_track.title}': {e}")

    def _evaluate_and_ingest(self, artist_obj):
        """
        Checks if an artist is 'Folk Enough'. 
        If yes, triggers full album ingestion.
        """
        name = artist_obj['name']
        genres = artist_obj.get('genres', [])
        
        # THE GATEKEEPER CHECK
        # Returns True if any valid genre string appears inside any of the artist's genres
        is_folk = any(g for g in genres if any(valid in g.lower() for valid in VALID_GENRES))
        
        if is_folk:
            print(f"🎯 Found Folk Artist: {name} (Genres: {genres})")
            
            # --- THE CRITICAL UPDATE ---
            # We now call the full album ingestor instead of just top tracks
            self.ingestor.ingest_artist_albums(artist_obj['id'])
            # ---------------------------
            return True
        
        return False