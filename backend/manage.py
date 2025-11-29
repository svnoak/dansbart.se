import typer
from app.core.database import Base, engine, SessionLocal

# --- CHANGED: Import Advanced Workers ---
from app.workers.ingestion.spotify import SpotifyIngestor
from app.workers.ingestion.folkwiki import FolkwikiScraper
from app.services.analysis import AnalysisService
from app.workers.discovery.spider import DiscoverySpider
from app.workers.ingestion.source_finder import SourceFinder
from app.services.classification import ClassificationService
from app.services.training import TrainingService
from app.services.classification import ClassificationService

app = typer.Typer()

@app.command()
def init_db():
    """Creates the database tables"""
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
    """Downloads audio, saves YouTube links, and runs analysis"""
    db = SessionLocal()
    try:
        service = AnalysisService(db)
        print(f"🚀 Starting Analysis Service (Limit: {limit})")
        service.process_library(limit=limit, force=force)
        
    except Exception as e:
        print(f"❌ Critical Error in Analysis Service: {e}")
    finally:
        db.close()

@app.command()
def classify(limit: int = 50, force: bool = False):
    """Classifies tracks into Dance Styles using Multi-Label Logic"""
    db = SessionLocal()
    try:
        # Initialize the Service (The Body), not just the Classifier (The Brain)
        service = ClassificationService(db)
        
        # Run the orchestration method
        service.classify_pending_tracks(limit=limit, force_refresh=force)
    finally:
        db.close()

@app.command()
def discover(limit: int = 1):
    """Crawls Spotify for new folk artists"""
    db = SessionLocal()
    try:
        spider = DiscoverySpider(db)
        spider.crawl_related_artists(seed_limit=limit)
    finally:
        db.close()

@app.command()
def build_ground_truth(style: str = "Hambo", limit: int = 20):
    """Scrapes Folkwiki to build a rhythmic profile"""
    db = SessionLocal()
    try:
        scraper = FolkwikiScraper(db)
        scraper.build_ground_truth(style, limit)
    finally:
        db.close()

@app.command()
def check_coverage():
    """Reports how many tracks are successfully classified"""
    from app.core.models import Track, TrackDanceStyle
    db = SessionLocal()
    try:
        total = db.query(Track).count()
        classified = db.query(TrackDanceStyle).distinct(TrackDanceStyle.track_id).count()
        print(f"📊 Coverage: {classified}/{total} tracks classified ({int((classified/total)*100) if total else 0}%)")
    finally:
        db.close()

@app.command()
def find_sources(limit: int = 50):
    """Finds YouTube playback links for tracks that are missing them"""
    db = SessionLocal()
    try:
        finder = SourceFinder(db)
        finder.find_missing_youtube_links(limit)
    finally:
        db.close()

@app.command()
def optimize_ai():
    """
    Orchestrates the Active Learning Loop:
    1. TrainingService fetches DB feedback -> Trains Model.
    2. ClassificationService reads new Model -> Updates Library.
    """
    db = SessionLocal()
    try:
        # 1. Initialize Services
        trainer = TrainingService(db)
        classifier = ClassificationService(db)

        # 2. Run Training
        print("=== STEP 1: TRAINING ===")
        training_success = trainer.train_from_feedback()

        # 3. Run Re-classification (Only if training actually happened/succeeded)
        if training_success:
            print("\n=== STEP 2: APPLYING KNOWLEDGE ===")
            classifier.reclassify_library(force=True)
        else:
            print("\n⏭️ Skipping re-classification (Model was not updated).")
            
    except Exception as e:
        print(f"❌ Critical Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    app()