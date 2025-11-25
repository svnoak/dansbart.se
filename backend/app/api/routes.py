from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.models import Track, TrackDanceStyle
from app.api.schemas import TrackOut

router = APIRouter()

@router.get("/tracks", response_model=list[TrackOut])
def get_tracks(
    style: str = Query(None, description="Filter by dance style (e.g. 'Hambo')"),
    min_bpm: int = Query(None),
    max_bpm: int = Query(None),
    db: Session = Depends(get_db)
):
    """
    Gets tracks with optional filtering by dance style and BPM range.
    Automatically joins 'Track' with 'TrackDanceStyle' for filtering.
    """
    query = db.query(
        Track.id, 
        Track.title, 
        Track.artist_name, 
        Track.album_name,
        TrackDanceStyle.dance_style,
        TrackDanceStyle.effective_bpm
    ).join(TrackDanceStyle)

    if style:
        query = query.filter(TrackDanceStyle.dance_style.ilike(style))
    
    if min_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm >= min_bpm)
        
    if max_bpm:
        query = query.filter(TrackDanceStyle.effective_bpm <= max_bpm)

    results = query.all()
    
    track_ids = [row.id for row in results]
    tracks = db.query(Track).filter(Track.id.in_(track_ids)).all()

        # Map in the 'selected' style (since a track can have multiple)
        # This is a bit "hacky" but quick for MVP
    final_response = []
    for track in tracks:
        matched_style = next((s for s in track.dance_styles if (not style or s.dance_style.lower() == style.lower())), track.dance_styles[0])
        
        track_dto = TrackOut(
            id=track.id,
            title=track.title,
            artist_name=track.artist_name,
            album_name=track.album_name,
            dance_style=matched_style.dance_style,
            effective_bpm=matched_style.effective_bpm,
            playback_links=[
                {"platform": l.platform, "deep_link": l.deep_link} for l in track.playback_links
            ]
        )
        final_response.append(track_dto)

    return final_response