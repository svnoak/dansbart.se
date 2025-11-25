import typer
print("DEBUG: manage.py is running!")
from app.core.database import Base, engine, SessionLocal
from app.repository.track import TrackRepository
from app.workers.ingestion.spotify import SpotifyIngestor
from app.workers.ingestion.folkwiki import FolkwikiScraper # <--- 1. NEW IMPORT
from app.workers.audio.analyzer import AudioAnalyzer
from app.workers.synthesis.classifier import DanceClassifier
from app.workers.discovery.spider import DiscoverySpider

app = typer.Typer()

@app.command()
def init_db():
    """Creates the database tables (Run this first!)"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created!")

@app.command()
def ingest_playlist(playlist_id: str):
    """Scrapes a Spotify playlist and saves tracks to DB"""
    print(f"DEBUG: Entering ingest_playlist with {playlist_id}")
    db = SessionLocal()
    try:
        ingestor = SpotifyIngestor(db)
        ingestor.ingest_playlist(playlist_id)
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

@app.command()
def analyze_audio(limit: int = 5, force: bool = False):
    """Downloads and analyzes audio for existing tracks"""
    db = SessionLocal()
    try:
        analyzer = AudioAnalyzer(db)
        analyzer.analyze_pending_tracks(limit, force)
    finally:
        db.close()

@app.command()
def classify(limit: int = 50):
    """Classifies tracks into Dance Styles based on BPM + Title"""
    db = SessionLocal()
    try:
        classifier = DanceClassifier(db)
        classifier.classify_tracks(limit)
    finally:
        db.close()

@app.command()
def discover(limit: int = 1):
    """Crawls Spotify for new folk artists based on existing tracks"""
    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        spider.crawl_related_artists(seed_limit=limit)
    finally:
        db.close()

# --- 2. NEW COMMAND START ---
@app.command()
def build_ground_truth(style: str = "Hambo", limit: int = 20):
    """Scrapes Folkwiki to build a rhythmic profile for a genre"""
    db = SessionLocal()
    try:
        scraper = FolkwikiScraper(db)
        scraper.build_ground_truth(style, limit)
    finally:
        db.close()
# --- NEW COMMAND END ---

@app.command()
def check_coverage():
    """Reports how many tracks are successfully classified"""
    # (Optional helper we discussed earlier)
    from app.core.models import Track, TrackDanceStyle
    db = SessionLocal()
    try:
        total = db.query(Track).count()
        classified = db.query(TrackDanceStyle).count()
        print(f"📊 Coverage: {classified}/{total} tracks classified ({int((classified/total)*100) if total else 0}%)")
    finally:
        db.close()

@app.command()
def seed_fake_track():
    """Test inserting a track manually"""
    db = SessionLocal()
    try:
        repo = TrackRepository(db)
        if repo.get_by_isrc("SE-123-45"):
            print("Track already exists!")
            return
        track = repo.create_track(title="Boda Hambo", artist="Rättviks Spelmanslag", isrc="SE-123-45")
        repo.add_playback_link(track.id, "spotify", "spotify:track:xyz")
        print(f"Created track: {track.title} with ID: {track.id}")
    finally:
        db.close()

if __name__ == "__main__":
    app()