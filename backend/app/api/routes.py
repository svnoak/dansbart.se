from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.schemas import TrackOut, LinkSubmission, FeedbackIn

# Services
from app.services.tracks import TrackService
from app.services.feedback import FeedbackService
from app.services.links import LinkService
from app.services.stats import StatsService
from app.services.analysis import AnalysisService
from app.services.training import TrainingService
from app.services.classification import ClassificationService

router = APIRouter()

# --- ROUTES ---
@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    service = TrackService(db)
    return service.get_playable_tracks(
        style=style, 
        min_bpm=min_bpm, 
        max_bpm=max_bpm
    )

@router.post("/tracks/{track_id}/feedback")
def submit_track_feedback(
    track_id: str, 
    feedback: FeedbackIn, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # 1. Process Logic via Service
    service = FeedbackService(db)
    updated_data = service.process_feedback(
        track_id=track_id,
        style=feedback.style,
        tempo_correction=feedback.tempo_correction
    )

    if not updated_data:
        raise HTTPException(status_code=404, detail="Track not found")

    # 2. Trigger Background Learning
    def run_learning_loop():
        trainer = TrainingService(db)
        classifier = ClassificationService(db)
        did_train = trainer.train_from_feedback(min_confirmations=1)
        if did_train:
            classifier.reclassify_library()

    background_tasks.add_task(run_learning_loop)
    
    # 3. Return the new data to the frontend
    return {
        "status": "success", 
        "message": "Feedback recorded.",
        "updates": updated_data
    }

@router.post("/tracks/{track_id}/links")
def submit_link(
    track_id: str, 
    submission: LinkSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    service = LinkService(db)
    result = service.add_user_link(track_id, submission.url)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    # --- TRIGGER RE-ANALYSIS ---
    # Define the background task wrapper
    def run_analysis_job(tid: str):
        print(f"🕵️‍♀️ Background Task: Analyzing {tid} with new link...")
        # Re-instantiate service to ensure clean session state
        analysis_service = AnalysisService(db)
        analysis_service.analyze_track_by_id(tid)

    # Schedule it
    background_tasks.add_task(run_analysis_job, track_id)
    
    return result

@router.patch("/links/{link_id}/report")
def report_broken_link(
    link_id: str, 
    reason: str = Query("broken"), 
    db: Session = Depends(get_db)
):
    service = LinkService(db)
    success = service.report_broken(link_id, reason)
    
    if not success:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"status": "success", "message": f"Link flagged as {reason}"}

@router.get("/stats")
def get_library_stats(db: Session = Depends(get_db)):
    service = StatsService(db)
    return service.get_global_stats()