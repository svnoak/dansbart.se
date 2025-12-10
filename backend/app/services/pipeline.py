from sqlalchemy.orm import Session
from app.workers.ingestion.spotify import SpotifyIngestor
from app.services.analysis import AnalysisService
from app.workers.tasks import analyze_track_task

class PipelineService:
    def __init__(self, db: Session):
        self.db = db

    def ingest_and_process(self, resource_id: str, resource_type: str = "playlist"):
        """
        Generic ingestion method supporting playlist, album, or artist.
        1. Ingest (Blocking, creates DB rows).
        2. Schedule Analysis for every track found.
        """
        # 1. INGEST (Synchronous)
        ingestor = SpotifyIngestor(self.db)

        if resource_type == "playlist":
            track_ids = ingestor.ingest_playlist(resource_id)
        elif resource_type == "album":
            track_ids = ingestor.ingest_album(resource_id)
        elif resource_type == "artist":
            track_ids = ingestor.ingest_artist_albums(resource_id)
        else:
            return {"status": "error", "message": f"Invalid resource type: {resource_type}"}

        if not track_ids:
            return {"status": "error", "message": "No tracks found or Spotify error."}

        # 2. SCHEDULE ANALYSIS (Asynchronous)
        print(f"⚙️ Scheduling analysis for {len(track_ids)} tracks...")

        for tid in track_ids:
            analyze_track_task.delay(tid)

        return {
            "status": "success",
            "message": f"Ingested {len(track_ids)} tracks from {resource_type}. Analysis running in background."
        }

    def ingest_and_process_playlist(self, playlist_id: str):
        """
        Legacy method for playlist ingestion (backwards compatibility).
        """
        return self.ingest_and_process(playlist_id, "playlist")

    def _analyze_job(self, track_id: str):
        """
        Wrapper to run analysis in background.
        Note: AnalysisService automatically triggers ClassificationService.
        """
        # Re-instantiate service to be safe with DB sessions in threads
        analyzer = AnalysisService(self.db)
        analyzer.analyze_track_by_id(track_id)