from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.models import Track, TrackDanceStyle, PlaybackLink
from app.api.schemas import TrackOut

router = APIRouter()

@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None, description="Filter by dance style"),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Track)

    query = query.join(Track.dance_styles)

    if style:
        query = query.filter(TrackDanceStyle.dance_style.ilike(style))
    if min_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
    if max_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

    query = query.options(joinedload(Track.playback_links), joinedload(Track.dance_styles))

    tracks = query.distinct().all()

    final_response = []
    for track in tracks:
        matched_style = next(
            (s for s in track.dance_styles if (not style or s.dance_style.lower() == style.lower())), 
            track.dance_styles[0]
        )
        
        final_response.append(TrackOut(
            id=track.id,
            title=track.title,
            artist_name=track.artist_name,
            album_name=track.album_name,
            dance_style=matched_style.dance_style,
            effective_bpm=matched_style.effective_bpm,
            playback_links=[
                {"platform": l.platform, "deep_link": l.deep_link} for l in track.playback_links
            ]
        ))

    return final_response