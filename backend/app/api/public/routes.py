from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.api.public.schemas import (
    TrackOut, LinkSubmission, FeedbackIn, StructureIn,
    StructureVersionOut, VoteIn, MovementVoteIn,
    PlaybackTrackingIn, InteractionTrackingIn, VisitorSessionIn
)
from app.core.models import TrackStructureVersion
from app.api.schemas import Page

# Services
from app.services.tracks import TrackService
from app.services.feedback import FeedbackService
from app.services.links import LinkService
from app.services.stats import StatsService
from app.services.analytics import AnalyticsService

router = APIRouter()

@router.get("/styles/tree")
def get_style_tree(db: Session = Depends(get_db)):
    """
    Returns the hierarchy of available styles for the filter dropdowns.
    Example: { "Polska": ["Slängpolska", "Hambo"], "Schottis": [] }
    """
    service = TrackService(db)
    return service.get_style_hierarchy()

@router.get("/tracks/{track_id}", response_model=TrackOut)
def get_track_by_id(
    track_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a single track by ID for deep linking.
    Returns full track details including dance style, tempo, and playback links.
    """
    service = TrackService(db)
    track = service.get_track_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track

@router.get("/tracks", response_model=Page[TrackOut])
def get_tracks(
    main_style: str = Query(None, description="Broad category (e.g., Polska)"),
    sub_style: str = Query(None, description="Specific dance (e.g., Slängpolska)"),
    style_confirmed: bool = Query(False, description="Filter by tracks with verified dancestyle only"),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    min_tempo: int = Query(None, ge=1, le=5, description="Minimum tempo level (1=Långsamt, 5=Väldigt snabbt)"),
    max_tempo: int = Query(None, ge=1, le=5, description="Maximum tempo level (1=Långsamt, 5=Väldigt snabbt)"),
    search: str = Query(None, description="Search by track title"),
    source: str = Query(None, description="Filter by source: 'spotify' or 'youtube'"),
    vocals: str = Query(None, description="Filter vocals: 'instrumental' or 'vocals'"),
    min_duration: int = Query(None, description="Minimum duration in seconds"),
    max_duration: int = Query(None, description="Maximum duration in seconds"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    service = TrackService(db)
    return service.get_playable_tracks(
        main_style=main_style,
        sub_style=sub_style,
        style_confirmed=style_confirmed,
        min_bpm=min_bpm,
        max_bpm=max_bpm,
        min_tempo=min_tempo,
        max_tempo=max_tempo,
        search=search,
        source=source,
        vocals=vocals,
        min_duration=min_duration,
        max_duration=max_duration,
        limit=limit,
        offset=offset
    )

@router.post("/tracks/{track_id}/feedback")
def submit_track_feedback(
    track_id: str, 
    feedback: FeedbackIn, 
    background_tasks: BackgroundTasks,
    x_voter_id: str = Header(..., alias="X-Voter-ID"),
    db: Session = Depends(get_db)
):
    service = FeedbackService(db)
    updated_data = service.process_feedback(
        track_id=track_id,
        style=feedback.style,
        tempo_correction=feedback.tempo_correction,
        tempo_category=feedback.tempo_category,
        explicit_main_style=feedback.main_style,
        voter_id=x_voter_id
    )

    if not updated_data:
        raise HTTPException(status_code=404, detail="Track not found")

    # Trigger Background Learning (lazy import to avoid loading worker deps)
    def run_learning_loop():
        from app.services.training import TrainingService
        from app.services.classification import ClassificationService

        bg_db = SessionLocal()
        try:
            trainer = TrainingService(bg_db) # Use bg_db here
            classifier = ClassificationService(bg_db)
            did_train = trainer.train_from_feedback(min_confirmations=1)
            if did_train:
                classifier.reclassify_library()
        finally:
            bg_db.close()
            
    background_tasks.add_task(run_learning_loop)
    
    return {
        "status": "success", 
        "message": "Feedback recorded.",
        "updates": updated_data
    }

@router.post("/tracks/{track_id}/confirm-secondary")
def confirm_secondary_style(
    track_id: str,
    feedback: FeedbackIn,
    db: Session = Depends(get_db)
):
    """
    Confirms a secondary style WITHOUT affecting primary election.
    Used for "Can you also dance X?" confirmations.
    """
    service = FeedbackService(db)
    result = service.confirm_secondary_style(
        track_id=track_id,
        style=feedback.style
    )

    if not result:
        raise HTTPException(status_code=404, detail="Track or style not found")

    return {
        "status": "success",
        "message": "Secondary style confirmed.",
        "updates": result
    }

@router.post("/tracks/{track_id}/movement")
def submit_movement_vote(
    track_id: str,
    payload: MovementVoteIn,
    db: Session = Depends(get_db)
):
    """
    Receives tags like ["Sviktande", "Tungt"] for a specific track.
    Updates the global wisdom for that dance style.
    """
    service = FeedbackService(db)
    success = service.process_movement_feedback(
        track_id=track_id,
        style=payload.dance_style,
        tags=payload.tags
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Track not found")
        
    return {"status": "success", "message": "Movement feedback recorded"}

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

    # Trigger Re-analysis task (lazy import to avoid loading heavy deps)
    from app.workers.tasks import analyze_track_task
    analyze_track_task.delay(track_id)

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

# --- NEW & UPDATED STRUCTURE ROUTES ---
@router.post("/tracks/{track_id}/structure")
def submit_structure_proposal(
    track_id: str, 
    payload: StructureIn,
    description: str = Query(None, description="Short note on what you fixed"),
    db: Session = Depends(get_db)
):
    """
    Creates a new Candidate Version instead of overwriting.
    """
    service = FeedbackService(db)
    new_version = service.create_structure_version(
        track_id=track_id,
        bars=payload.bars,
        sections=payload.sections,
        labels=payload.section_labels,
        description=description,
        author_alias=payload.author_alias
    )

    if not new_version:
        raise HTTPException(status_code=404, detail="Track not found")
    
    return {
        "status": "success", 
        "message": "Version created", 
        "version_id": new_version.id,
        "is_active": new_version.is_active # Tell frontend if their edit went live immediately
    }

@router.get("/tracks/{track_id}/structure-versions", response_model=list[StructureVersionOut])
def get_structure_versions(track_id: str, db: Session = Depends(get_db)):
    """
    Returns the list of versions for the carousel.
    """
    versions = (
        db.query(TrackStructureVersion)
        .filter(
            TrackStructureVersion.track_id == track_id,
            TrackStructureVersion.is_hidden == False
        )
        .order_by(
            TrackStructureVersion.is_active.desc(),  # Active first
            TrackStructureVersion.vote_count.desc(), # Highest votes
            TrackStructureVersion.created_at.desc()  # Newest
        )
        .all()
    )
    return versions

@router.post("/structure-versions/{version_id}/vote")
def vote_on_version(
    version_id: str, 
    vote: VoteIn, 
    db: Session = Depends(get_db)
):
    """
    NEW: Allows upvoting/downvoting a specific version.
    """
    service = FeedbackService(db)
    result = service.vote_on_structure(version_id, vote.vote_type)
    
    if not result:
        raise HTTPException(status_code=404, detail="Version not found")
        
    return result

@router.post("/structure-versions/{version_id}/report")
def report_version(version_id: str, db: Session = Depends(get_db)):
    """
    NEW: Flags a version as spam/bogus.
    """
    service = FeedbackService(db)
    service.report_structure(version_id)

@router.post("/tracks/{track_id}/flag")
def flag_track(track_id: str, reason: str = "not_folk_music", db: Session = Depends(get_db)):
    """
    Flag a track as not being folk music.
    This will hide it from the main feed until reviewed by an admin.
    """
    from app.core.models import Track
    from datetime import datetime

    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Flag the track
    track.is_flagged = True
    track.flagged_at = datetime.now()
    track.flag_reason = reason
    db.commit()

    return {"status": "success", "message": "Track flagged successfully"}

@router.delete("/tracks/{track_id}/flag")
def unflag_track(track_id: str, db: Session = Depends(get_db)):
    """
    Remove flag from a track (admin override).
    """
    from app.core.models import Track

    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Unflag the track
    track.is_flagged = False
    track.flagged_at = None
    track.flag_reason = None
    db.commit()

    return {"status": "success", "message": "Track unflagged successfully"}

# ========== ANALYTICS ENDPOINTS ==========

@router.post("/analytics/track/playback/{track_id}")
def record_track_playback(
    track_id: str,
    playback: PlaybackTrackingIn,
    db: Session = Depends(get_db)
):
    """
    Record a track playback event with listen duration.
    """
    AnalyticsService.record_playback(
        db=db,
        track_id=track_id,
        platform=playback.platform,
        session_id=playback.session_id,
        duration_seconds=playback.duration_seconds,
        completed=playback.completed
    )
    return {"status": "success"}

@router.post("/analytics/track/interaction")
def record_interaction(
    interaction: InteractionTrackingIn,
    db: Session = Depends(get_db)
):
    """
    Record a user interaction event (nudge shown, modal opened, etc.).
    """
    AnalyticsService.record_interaction(
        db=db,
        event_type=interaction.event_type,
        track_id=interaction.track_id,
        event_data=interaction.event_data,
        session_id=interaction.session_id
    )
    return {"status": "success"}

@router.post("/analytics/session")
def track_session(
    session: VisitorSessionIn,
    db: Session = Depends(get_db)
):
    """
    Track or update a visitor session.
    """
    AnalyticsService.track_visitor_session(
        db=db,
        session_id=session.session_id,
        user_agent=session.user_agent,
        is_returning=session.is_returning
    )
    return {"status": "success"}