from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.models import Track, TrackDanceStyle, PlaybackLink, TrackFeedback
from app.core.music_theory import categorize_tempo
from app.api.schemas import TrackOut
from fastapi import HTTPException
from pydantic import BaseModel


router = APIRouter()

class FeedbackIn(BaseModel):
    style: str  # e.g., "Hambo"
    tempo_correction: str # "ok", "half", "double"

@router.post("/tracks/{track_id}/feedback")
def submit_track_feedback(
    track_id: str, 
    feedback: FeedbackIn, 
    db: Session = Depends(get_db)
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # 1. SAVE HISTORY
    existing_fb = db.query(TrackFeedback).filter(TrackFeedback.track_id == track.id).first()
    if existing_fb:
        existing_fb.suggested_style = feedback.style
        existing_fb.tempo_correction = feedback.tempo_correction
    else:
        new_fb = TrackFeedback(
            track_id=track.id,
            suggested_style=feedback.style,
            tempo_correction=feedback.tempo_correction
        )
        db.add(new_fb)

    # 2. CALCULATE METRICS
    new_multiplier = 1.0
    if feedback.tempo_correction == "half":
        new_multiplier = 0.5
    elif feedback.tempo_correction == "double":
        new_multiplier = 2.0
    
    source = next((s for s in track.analysis_sources if s.source_type == 'hybrid_ml_v2'), None)
    raw_bpm = source.raw_data.get('tempo_bpm', 0) if source else 0
    new_effective_bpm = int(raw_bpm * new_multiplier)
    new_category = categorize_tempo(feedback.style, new_effective_bpm)

    # --- THE SMART LOGIC ---

    # A. PURGE ROBOTS: Delete incorrect AI guesses
    # Logic: Delete any style that is NOT the one we are fixing AND was NOT confirmed by a human.
    db.query(TrackDanceStyle).filter(
        TrackDanceStyle.track_id == track.id,
        TrackDanceStyle.dance_style != feedback.style,
        TrackDanceStyle.is_user_confirmed == False # Only delete unconfirmed rows
    ).delete(synchronize_session=False)

    # B. DEMOTE HUMANS: Keep other valid styles, but make them secondary
    # If someone previously said "Schottis" and verified it, keep it! Just turn off is_primary.
    db.query(TrackDanceStyle).filter(
        TrackDanceStyle.track_id == track.id,
        TrackDanceStyle.dance_style != feedback.style,
        TrackDanceStyle.is_user_confirmed == True 
    ).update({"is_primary": False})

    # C. UPSERT TARGET: Update or Create the Feedback Style
    target_style_row = db.query(TrackDanceStyle).filter(
        TrackDanceStyle.track_id == track.id,
        TrackDanceStyle.dance_style == feedback.style
    ).first()

    if target_style_row:
        # Update existing row
        target_style_row.is_primary = True
        target_style_row.bpm_multiplier = new_multiplier
        target_style_row.effective_bpm = new_effective_bpm
        target_style_row.tempo_category = new_category
        target_style_row.is_user_confirmed = True 
        target_style_row.confidence = 1.0
        db.add(target_style_row)
    else:
        # Create new row
        new_style_row = TrackDanceStyle(
            track_id=track.id,
            dance_style=feedback.style,
            is_primary=True,
            bpm_multiplier=new_multiplier,
            effective_bpm=new_effective_bpm,
            tempo_category=new_category,
            is_user_confirmed=True,
            confidence=1.0
        )
        db.add(new_style_row)

    db.commit()
    
    return {"status": "success", "message": "Feedback received. Track corrected."}

@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    # 1. Base Query: Only fetch tracks that have a Dance Style
    # (If a track isn't analyzed/classified yet, we don't show it in the main feed)
    query = db.query(Track).join(Track.dance_styles)

    # 2. Filtering (Database Side)
    if style:
        query = query.filter(TrackDanceStyle.dance_style.ilike(style))
    if min_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
    if max_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

    # 3. Optimize Loading
    query = query.options(
        joinedload(Track.playback_links), 
        joinedload(Track.dance_styles)
    )
    
    tracks = query.distinct().all()

    final_response = []
    for track in tracks:
        # A. Find the Style Data
        # We prioritize the style the user filtered for, otherwise the Primary style
        matched_style = next(
            (s for s in track.dance_styles if (not style or s.dance_style.lower() == style.lower())), 
            next((s for s in track.dance_styles if s.is_primary), None)
        )
        
        if not matched_style:
            continue

        # B. Filter Broken Sources (The Logic You Asked For)
        # We exclude any link where is_working is False.
        valid_links = [
            {"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} 
            for l in track.playback_links 
            if l.is_working
        ]

        # C. Safety Check
        # If Spotify is there, valid_links is not empty -> We show the track.
        # If valid_links IS empty (both Spotify and YT broken), we skip the track.
        if not valid_links:
            continue 

        # D. Build Response
        final_response.append(TrackOut(
            id=str(track.id),
            title=track.title,
            artist_name=track.artist_name,
            album_name=track.album_name,
            
            # Style Info
            dance_style=matched_style.dance_style,
            effective_bpm=matched_style.effective_bpm,
            tempo_category=matched_style.tempo_category,
            style_confidence=matched_style.confidence,
            has_vocals=track.has_vocals,
            
            # Filtered Links
            playback_links=valid_links
        ))

    return final_response

@router.patch("/links/{link_id}/report")
def report_broken_link(
    link_id: str, 
    reason: str = Query("broken"), # Default to 'broken', accept 'wrong_track'
    db: Session = Depends(get_db)
):
    link = db.query(PlaybackLink).filter(PlaybackLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # In both cases (Broken or Wrong Track), the link is bad for the user.
    # So we disable it.
    link.is_working = False
    
    # Optional: If you eventually add a 'status_note' column to your DB:
    # link.status_note = reason 
    
    db.commit()
    
    print(f"🔗 Link {link_id} reported. Reason: {reason}") # Visible in docker logs
    
    return {"status": "success", "message": f"Link flagged as {reason}"}