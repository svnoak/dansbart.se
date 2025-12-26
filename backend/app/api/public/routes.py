from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.api.public.schemas import (
    TrackOut, LinkSubmission, FeedbackIn, StructureIn,
    StructureVersionOut, VoteIn, MovementVoteIn,
    PlaybackTrackingIn, InteractionTrackingIn, VisitorSessionIn,
    ArtistDetailOut, AlbumDetailOut, ArtistListItemOut, AlbumListItemOut
)
from app.core.models import TrackStructureVersion
from app.api.schemas import Page

# Services
from app.services.tracks import TrackService
from app.services.feedback import FeedbackService
from app.services.links import LinkService
from app.services.stats import StatsService
from app.services.analytics import AnalyticsService
from app.services.data_export import DataExportService

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
    min_bounciness: float = Query(None, ge=0, le=1, description="Minimum bounciness (0-1)"),
    max_bounciness: float = Query(None, ge=0, le=1, description="Maximum bounciness (0-1)"),
    min_articulation: float = Query(None, ge=0, le=1, description="Minimum articulation (0-1)"),
    max_articulation: float = Query(None, ge=0, le=1, description="Maximum articulation (0-1)"),
    music_genre: str = Query(None, description="Filter by music genre: 'traditional_folk' (includes all folk genres), 'modern_folk', 'folk_pop', 'contemporary'"),
    sort: str = Query("confidence", description="Field to sort by: confidence, created_at, bpm, etc."),
    order: str = Query("desc", description="Direction: asc or desc"),
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
        min_bounciness=min_bounciness,
        max_bounciness=max_bounciness,
        min_articulation=min_articulation,
        max_articulation=max_articulation,
        music_genre=music_genre,
        sort_by=sort,
        sort_order=order,
        limit=limit,
        offset=offset
    )

@router.get("/tracks/{track_id}/similar")
def get_similar_tracks(
    track_id: str,
    limit: int = Query(10, ge=1, le=50, description="Number of similar tracks to return"),
    style_filter: str = Query("same", description="Style filter: 'same', 'similar', or 'any'"),
    db: Session = Depends(get_db)
):
    """
    Get tracks similar to the given track using vector embeddings.
    Uses pgvector cosine similarity on 216-dimensional audio embeddings.

    Style filters:
    - same: Only tracks with the same dance style
    - similar: Mix of same and related styles (70% same, 30% variety)
    - any: All styles based purely on audio similarity
    """
    service = TrackService(db)
    similar = service.get_similar_tracks(track_id, limit, style_filter)
    if not similar:
        raise HTTPException(status_code=404, detail="Track not found or has no embeddings")
    return similar

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
        manual_bpm=feedback.manual_bpm,
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

# ========== DISCOVERY ENDPOINTS ==========

@router.get("/discovery/popular", response_model=list[TrackOut])
def get_popular_tracks(
    limit: int = Query(6, ge=1, le=20, description="Number of tracks to return"),
    days: int = Query(7, ge=1, le=90, description="Days to look back for popularity"),
    db: Session = Depends(get_db)
):
    """
    Get most played tracks with good completion rates for discovery page.
    Uses playback analytics to surface engaging tracks.
    """
    analytics_service = AnalyticsService
    track_service = TrackService(db)

    # Get most played tracks with completion rate
    analytics_data = analytics_service.get_most_played_tracks_with_completion(
        db, limit=limit * 2, days=days  # Get 2x to filter for quality
    )

    # Filter for tracks with good completion rate (>50%)
    quality_tracks = [
        t for t in analytics_data
        if t.get('completion_rate', 0) > 50
    ][:limit]

    # Get full track data
    track_ids = [t['track_id'] for t in quality_tracks]
    tracks = []
    for track_id in track_ids:
        track = track_service.get_track_by_id(track_id)
        if track:
            tracks.append(track)

    return tracks

@router.get("/discovery/recent", response_model=list[TrackOut])
def get_recent_tracks(
    limit: int = Query(6, ge=1, le=20, description="Number of tracks to return"),
    db: Session = Depends(get_db)
):
    """
    Get recently added verified tracks for discovery page.
    Only returns tracks with confirmed styles and playable links.
    """
    from app.core.models import Track, PlaybackLink, TrackDanceStyle, TrackArtist
    from sqlalchemy.orm import selectinload, joinedload

    track_service = TrackService(db)

    track_models = db.query(Track).join(
        Track.playback_links
    ).join(
        Track.dance_styles
    ).filter(
        PlaybackLink.is_working == True,
        TrackDanceStyle.confidence >= 1.0,  # Verified only
        Track.is_flagged == False
    ).options(
        selectinload(Track.dance_styles),
        selectinload(Track.artist_links).joinedload(TrackArtist.artist),
        joinedload(Track.album),
        selectinload(Track.playback_links)
    ).order_by(
        Track.created_at.desc()
    ).distinct().limit(limit).all()

    # Format tracks using TrackService
    tracks = []
    for track_model in track_models:
        formatted = track_service.get_track_by_id(str(track_model.id))
        if formatted:
            tracks.append(formatted)

    return tracks

@router.get("/discovery/curated", response_model=list[TrackOut])
def get_curated_tracks(
    limit: int = Query(6, ge=1, le=20, description="Number of tracks to return"),
    db: Session = Depends(get_db)
):
    """
    Get high-quality curated tracks for discovery page.
    Criteria: verified style, audio analysis complete, sorted by popularity.
    """
    from app.core.models import Track, TrackPlayback, PlaybackLink, TrackDanceStyle, TrackArtist
    from sqlalchemy import func
    from sqlalchemy.orm import selectinload, joinedload

    track_service = TrackService(db)

    # Query for high-quality tracks sorted by play count
    from sqlalchemy import desc

    play_counts = db.query(
        TrackPlayback.track_id,
        func.count(TrackPlayback.id).label('plays')
    ).group_by(TrackPlayback.track_id).subquery()

    # Get qualifying track IDs with play counts in SELECT for proper ordering with DISTINCT
    track_ids_query = db.query(
        Track.id,
        func.coalesce(play_counts.c.plays, 0).label('play_count')
    ).join(
        Track.playback_links
    ).join(
        Track.dance_styles
    ).outerjoin(
        play_counts, Track.id == play_counts.c.track_id
    ).filter(
        PlaybackLink.is_working == True,
        TrackDanceStyle.confidence == 1.0,  # User-confirmed only
        Track.is_flagged == False,
        Track.bounciness != None,  # Has audio analysis
        Track.articulation != None
    ).distinct().order_by(
        desc('play_count')
    ).limit(limit)

    track_ids = [row[0] for row in track_ids_query.all()]

    # Fetch full tracks with eager loading
    track_models = db.query(Track).filter(
        Track.id.in_(track_ids)
    ).options(
        selectinload(Track.dance_styles),
        selectinload(Track.artist_links).joinedload(TrackArtist.artist),
        joinedload(Track.album),
        selectinload(Track.playback_links)
    ).all()

    # Sort by original order
    track_dict = {str(t.id): t for t in track_models}
    track_models = [track_dict[str(tid)] for tid in track_ids if str(tid) in track_dict]

    # Format tracks using TrackService
    tracks = []
    for track_model in track_models:
        formatted = track_service.get_track_by_id(str(track_model.id))
        if formatted:
            tracks.append(formatted)

    return tracks

@router.get("/discovery/by-style")
def get_style_overview(db: Session = Depends(get_db)):
    """
    Get overview of all dance styles with track counts for explorer cards.
    Returns styles sorted by popularity (track count).
    """
    from app.core.models import Track, PlaybackLink, TrackDanceStyle
    from sqlalchemy import func

    service = TrackService(db)

    # Get track counts per style
    style_counts = db.query(
        TrackDanceStyle.dance_style,
        func.count(Track.id.distinct()).label('count')
    ).join(
        TrackDanceStyle.track
    ).join(
        Track.playback_links
    ).filter(
        PlaybackLink.is_working == True,
        TrackDanceStyle.dance_style != None,
        Track.is_flagged == False
    ).group_by(
        TrackDanceStyle.dance_style
    ).all()

    # Get style hierarchy
    tree = service.get_style_hierarchy()

    # Build result with counts
    result = []
    count_map = {style: count for style, count in style_counts}

    for main_style, sub_styles in tree.items():
        # Count includes main style + all sub styles
        total = count_map.get(main_style, 0)
        for sub in sub_styles:
            total += count_map.get(sub, 0)

        if total > 0:  # Only include styles with tracks
            result.append({
                "style": main_style,
                "sub_styles": sub_styles,
                "track_count": total
            })

    # Sort by track count descending
    return sorted(result, key=lambda x: x['track_count'], reverse=True)

@router.get("/discovery/playlists")
def get_curated_playlists(db: Session = Depends(get_db)):
    """
    Get curated playlists with tracks for discovery page.
    Returns multiple themed playlists based on track metadata.
    """
    from app.services.discovery import DiscoveryService

    service = DiscoveryService(db)
    return service.get_all_playlists()

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

# ========== ARTIST ENDPOINTS ==========

@router.get("/artists", response_model=Page[ArtistListItemOut])
def get_artists(
    search: str = Query(None, description="Search by artist name"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of artists with track counts.
    """
    from app.services.artists import ArtistService

    service = ArtistService(db)
    return service.get_artists_paginated(
        search=search,
        limit=limit,
        offset=offset
    )

@router.get("/artists/{artist_id}", response_model=ArtistDetailOut)
def get_artist_by_id(
    artist_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a single artist by ID with details and albums.
    """
    from app.services.artists import ArtistService
    import uuid

    try:
        artist_uuid = uuid.UUID(artist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artist ID format")

    service = ArtistService(db)
    try:
        return service.get_artist_by_id(artist_uuid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/artists/{artist_id}/tracks", response_model=Page[TrackOut])
def get_artist_tracks(
    artist_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get all tracks by a specific artist.
    """
    from app.services.artists import ArtistService
    import uuid

    try:
        artist_uuid = uuid.UUID(artist_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artist ID format")

    service = ArtistService(db)
    return service.get_artist_tracks(
        artist_id=artist_uuid,
        limit=limit,
        offset=offset
    )

# ========== ALBUM ENDPOINTS ==========

@router.get("/albums", response_model=Page[AlbumListItemOut])
def get_albums(
    search: str = Query(None, description="Search by album title"),
    artist_id: str = Query(None, description="Filter by artist ID"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of albums with track counts.
    """
    from app.services.albums import AlbumService
    import uuid

    service = AlbumService(db)

    artist_uuid = None
    if artist_id:
        try:
            artist_uuid = uuid.UUID(artist_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid artist ID format")

    return service.get_albums_paginated(
        search=search,
        artist_id=artist_uuid,
        limit=limit,
        offset=offset
    )

@router.get("/albums/{album_id}", response_model=AlbumDetailOut)
def get_album_by_id(
    album_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a single album by ID with details and track list.
    """
    from app.services.albums import AlbumService
    import uuid

    try:
        album_uuid = uuid.UUID(album_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid album ID format")

    service = AlbumService(db)
    try:
        return service.get_album_by_id(album_uuid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/albums/{album_id}/tracks", response_model=Page[TrackOut])
def get_album_tracks(
    album_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get all tracks from a specific album.
    """
    from app.services.albums import AlbumService
    import uuid

    try:
        album_uuid = uuid.UUID(album_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid album ID format")

    service = AlbumService(db)
    return service.get_album_tracks(
        album_id=album_uuid,
        limit=limit,
        offset=offset
    )

# ========== DATA EXPORT ENDPOINTS ==========

@router.get("/export/dataset")
def export_dataset(
    limit: int = Query(None, description="Limit number of tracks (omit for full export)"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """
    Export Dansbart's public dataset including:
    - Audio analysis features from neckenml-analyzer
    - Dance style classifications with confidence scores
    - Human feedback and ground truth data
    - Track structure annotations

    This data is provided under CC BY 4.0 license.
    Excludes proprietary platform data (Spotify/YouTube IDs, URLs, etc.)

    Use for:
    - Training and improving music analysis models
    - Research on folk music characteristics
    - Building complementary tools and services
    """
    service = DataExportService(db)
    return service.export_all_tracks(limit=limit, offset=offset)

@router.get("/export/feedback")
def export_feedback(db: Session = Depends(get_db)):
    """
    Export aggregated human feedback and ground truth data:
    - Style correction votes
    - Movement feel tags
    - Dance movement consensus data
    - User-contributed structure annotations

    This represents the collective wisdom of Dansbart users
    and can be used to validate or improve classification models.
    """
    service = DataExportService(db)
    return service.export_feedback_data()

@router.get("/export/stats")
def export_stats(db: Session = Depends(get_db)):
    """
    Get statistics about the available export dataset.
    Useful for understanding dataset size before downloading.
    """
    service = DataExportService(db)
    return service.get_export_stats()