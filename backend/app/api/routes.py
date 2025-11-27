from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.models import Track, TrackDanceStyle, PlaybackLink
from app.api.schemas import TrackOut
from fastapi import HTTPException

router = APIRouter()

@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    # 1. Start with Tracks joined to Dance Styles
    query = db.query(Track).join(Track.dance_styles)

    # 2. Apply Filters to the *DanceStyle* table (this is the "Dance Tempo" logic)
    if style:
        query = query.filter(TrackDanceStyle.dance_style.ilike(style))
    
    # This filters based on "How fast you dance it", not the raw audio BPM
    if min_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
    if max_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

    # 3. Optimize Loading
    query = query.options(joinedload(Track.playback_links), joinedload(Track.dance_styles))
    
    tracks = query.distinct().all()

    final_response = []
    for track in tracks:
        matched_style = next(
            (s for s in track.dance_styles if (not style or s.dance_style.lower() == style.lower())), 
            next((s for s in track.dance_styles if s.is_primary), track.dance_styles[0])
        )
        
        valid_links = [
            {"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} 
            for l in track.playback_links 
            if l.is_working
        ]

        final_response.append(TrackOut(
            id=track.id,
            title=track.title,
            artist_name=track.artist_name,
            album_name=track.album_name,
            dance_style=matched_style.dance_style,
            effective_bpm=matched_style.effective_bpm,
            has_vocals=track.has_vocals,
            style_confidence=matched_style.confidence,
            playback_links=valid_links
        ))

    return final_response

@router.patch("/links/{link_id}/report")
def report_broken_link(link_id: str, db: Session = Depends(get_db)):
    link = db.query(PlaybackLink).filter(PlaybackLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # Toggle off
    link.is_working = False
    db.commit()
    return {"status": "success", "message": "Link flagged as broken"}