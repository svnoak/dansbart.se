"""
Playlist API routes.

Provides CRUD operations for user playlists and track management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from uuid import uuid4
from datetime import datetime

from app.core.database import get_db
from app.core.user_models import User, Playlist, PlaylistTrack
from app.core.models import Track
from app.api.auth.dependencies import get_current_user, get_optional_user
from app.api.playlists.schemas import (
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistOut,
    PlaylistDetailOut,
    PlaylistTrackAdd,
    PlaylistTrackReorder,
    PlaylistOwnerOut,
    PlaylistTrackOut,
)

router = APIRouter(prefix="/playlists", tags=["Playlists"])


def _add_computed_fields(playlist: Playlist) -> None:
    """Add computed fields to playlist object."""
    playlist.track_count = len(playlist.track_links)
    playlist.total_duration_ms = sum(
        link.track.duration_ms or 0 for link in playlist.track_links
    )
    playlist.id = str(playlist.id)  # Convert UUID to string for schema


@router.get("/", response_model=list[PlaylistOut])
def list_user_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all playlists for the current user.

    Returns:
        List of playlists with track counts and durations
    """
    playlists = (
        db.query(Playlist)
        .options(joinedload(Playlist.user))
        .filter(Playlist.user_id == current_user.id)
        .order_by(Playlist.updated_at.desc())
        .all()
    )

    # Add computed fields
    for playlist in playlists:
        _add_computed_fields(playlist)

    return playlists


@router.post("/", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED)
def create_playlist(
    playlist_data: PlaylistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new playlist.

    Args:
        playlist_data: Playlist name, description, and visibility

    Returns:
        Created playlist
    """
    playlist = Playlist(
        user_id=current_user.id,
        name=playlist_data.name,
        description=playlist_data.description,
        is_public=playlist_data.is_public,
        share_token=str(uuid4()) if playlist_data.is_public else None,
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    # Load user relationship
    playlist.user = current_user

    # Add computed fields
    playlist.track_count = 0
    playlist.total_duration_ms = 0
    playlist.id = str(playlist.id)  # Convert UUID to string for schema

    return playlist


@router.get("/{playlist_id}", response_model=PlaylistDetailOut)
def get_playlist(
    playlist_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Get playlist details with all tracks.

    Accessible if:
    - Playlist is public, OR
    - User is the owner

    Args:
        playlist_id: Playlist UUID

    Returns:
        Playlist with full track list

    Raises:
        404: Playlist not found
        403: Playlist is private and user is not the owner
    """
    playlist = (
        db.query(Playlist)
        .options(
            joinedload(Playlist.user),
            joinedload(Playlist.track_links).joinedload(PlaylistTrack.track),
        )
        .filter(Playlist.id == playlist_id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Check permissions
    if not playlist.is_public:
        if not current_user or playlist.user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="This playlist is private"
            )

    # Add computed fields
    _add_computed_fields(playlist)

    return playlist


@router.get("/share/{share_token}", response_model=PlaylistDetailOut)
def get_playlist_by_share_token(
    share_token: str,
    db: Session = Depends(get_db),
):
    """
    Get public playlist by share token (no authentication required).

    Args:
        share_token: Playlist share token (UUID)

    Returns:
        Playlist with full track list

    Raises:
        404: Playlist not found or not public
    """
    playlist = (
        db.query(Playlist)
        .options(
            joinedload(Playlist.user),
            joinedload(Playlist.track_links).joinedload(PlaylistTrack.track),
        )
        .filter(Playlist.share_token == share_token, Playlist.is_public == True)
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404, detail="Playlist not found or not public"
        )

    # Add computed fields
    _add_computed_fields(playlist)

    return playlist


@router.put("/{playlist_id}", response_model=PlaylistOut)
def update_playlist(
    playlist_id: str,
    updates: PlaylistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update playlist metadata.

    Args:
        playlist_id: Playlist UUID
        updates: Fields to update

    Returns:
        Updated playlist

    Raises:
        404: Playlist not found or not owned by user
    """
    playlist = (
        db.query(Playlist)
        .options(joinedload(Playlist.user))
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Update fields
    if updates.name is not None:
        playlist.name = updates.name
    if updates.description is not None:
        playlist.description = updates.description
    if updates.is_public is not None:
        playlist.is_public = updates.is_public
        # Generate share token if going public, revoke if going private
        if updates.is_public and not playlist.share_token:
            playlist.share_token = str(uuid4())
        elif not updates.is_public:
            playlist.share_token = None

    playlist.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(playlist)

    # Add computed fields
    _add_computed_fields(playlist)

    return playlist


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a playlist.

    Cascade deletes all PlaylistTrack entries.

    Args:
        playlist_id: Playlist UUID

    Raises:
        404: Playlist not found or not owned by user
    """
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    db.delete(playlist)
    db.commit()
    return None


@router.post("/{playlist_id}/tracks", status_code=status.HTTP_201_CREATED)
def add_track_to_playlist(
    playlist_id: str,
    track_data: PlaylistTrackAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a track to a playlist.

    Args:
        playlist_id: Playlist UUID
        track_data: Track ID and optional position

    Returns:
        Success message with position

    Raises:
        404: Playlist or track not found
        400: Track already in playlist
    """
    # Verify ownership
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Verify track exists
    track = db.query(Track).filter(Track.id == track_data.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Check if track already in playlist
    existing = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == track_data.track_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Track already in playlist")

    # Determine position
    if track_data.position is None:
        max_position = (
            db.query(PlaylistTrack)
            .filter(PlaylistTrack.playlist_id == playlist_id)
            .count()
        )
        position = max_position
    else:
        position = track_data.position
        # Shift existing tracks down
        db.query(PlaylistTrack).filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.position >= position,
        ).update({"position": PlaylistTrack.position + 1})

    # Add track
    playlist_track = PlaylistTrack(
        playlist_id=playlist_id, track_id=track_data.track_id, position=position
    )
    db.add(playlist_track)

    # Update playlist timestamp
    playlist.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Track added", "position": position}


@router.delete(
    "/{playlist_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a track from a playlist.

    Args:
        playlist_id: Playlist UUID
        track_id: Track UUID

    Raises:
        404: Playlist or track not found
    """
    # Verify ownership
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Find and delete
    playlist_track = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == track_id,
        )
        .first()
    )

    if not playlist_track:
        raise HTTPException(status_code=404, detail="Track not in playlist")

    removed_position = playlist_track.position
    db.delete(playlist_track)

    # Shift remaining tracks up
    db.query(PlaylistTrack).filter(
        PlaylistTrack.playlist_id == playlist_id,
        PlaylistTrack.position > removed_position,
    ).update({"position": PlaylistTrack.position - 1})

    # Update playlist timestamp
    playlist.updated_at = datetime.utcnow()

    db.commit()
    return None


@router.put("/{playlist_id}/tracks/reorder")
def reorder_playlist_tracks(
    playlist_id: str,
    reorder: PlaylistTrackReorder,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reorder a track in a playlist (for drag-and-drop).

    Args:
        playlist_id: Playlist UUID
        reorder: Track ID and new position

    Returns:
        Success message with new position

    Raises:
        404: Playlist or track not found
    """
    # Verify ownership
    playlist = (
        db.query(Playlist)
        .filter(Playlist.id == playlist_id, Playlist.user_id == current_user.id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Find track
    playlist_track = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.track_id == reorder.track_id,
        )
        .first()
    )

    if not playlist_track:
        raise HTTPException(status_code=404, detail="Track not in playlist")

    old_position = playlist_track.position
    new_position = reorder.new_position

    if old_position == new_position:
        return {"message": "No change", "new_position": new_position}

    # Reorder logic
    if old_position < new_position:
        # Moving down: shift intermediate tracks up
        db.query(PlaylistTrack).filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.position > old_position,
            PlaylistTrack.position <= new_position,
        ).update({"position": PlaylistTrack.position - 1})
    else:
        # Moving up: shift intermediate tracks down
        db.query(PlaylistTrack).filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.position >= new_position,
            PlaylistTrack.position < old_position,
        ).update({"position": PlaylistTrack.position + 1})

    playlist_track.position = new_position
    playlist.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Track reordered", "new_position": new_position}
