"""
Playlist API routes.

Provides CRUD operations for user playlists and track management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, subqueryload
from uuid import uuid4
from datetime import datetime

from app.core.database import get_db
from app.core.user_models import User, Playlist, PlaylistTrack
from app.core.models import Track, TrackArtist, TrackAlbum
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
    PlaylistInviteCreate,
    PlaylistInviteUpdate,
    PlaylistCollaboratorOut,
    CollaboratorUserOut,
)
from app.api.playlists.permissions import (
    get_user_permission,
    can_edit_playlist,
    require_permission,
    is_owner,
)
from app.core.user_models import PlaylistCollaborator
from sqlalchemy import func, or_

router = APIRouter(prefix="/playlists", tags=["Playlists"])


def _serialize_track(track: Track) -> dict:
    """Serialize a Track object to dict for API response."""
    # Get primary dance style
    dance_style = "unknown"
    sub_style = None
    for ds in track.dance_styles:
        if ds.is_primary:
            dance_style = ds.dance_style
            sub_style = ds.sub_style
            break
    if dance_style == "unknown" and track.dance_styles:
        dance_style = track.dance_styles[0].dance_style
        sub_style = track.dance_styles[0].sub_style

    return {
        "id": str(track.id),
        "title": track.title,
        "duration_ms": track.duration_ms,
        "artist": {
            "id": str(track.primary_artist.id) if track.primary_artist else None,
            "name": track.primary_artist.name if track.primary_artist else "Unknown",
        } if track.primary_artist else None,
        "album": {
            "id": str(track.album.id) if track.album else None,
            "name": track.album.name if track.album else None,
        } if track.album else None,
        "dance_style": dance_style,
        "sub_style": sub_style,
    }


def _add_computed_fields(playlist: Playlist) -> None:
    """Add computed fields to playlist object."""
    playlist.track_count = len(playlist.track_links)
    playlist.total_duration_ms = sum(
        link.track.duration_ms or 0 for link in playlist.track_links
    )
    playlist.id = str(playlist.id)  # Convert UUID to string for schema


def _serialize_playlist_detail(playlist: Playlist) -> dict:
    """Serialize a playlist with full track details for API response."""
    tracks = []
    for link in playlist.track_links:
        tracks.append({
            "id": str(link.id),
            "track": _serialize_track(link.track),
            "position": link.position,
            "added_at": link.added_at,
        })

    return {
        "id": str(playlist.id),
        "name": playlist.name,
        "description": playlist.description,
        "is_public": playlist.is_public,
        "share_token": playlist.share_token,
        "track_count": len(playlist.track_links),
        "total_duration_ms": sum(link.track.duration_ms or 0 for link in playlist.track_links),
        "created_at": playlist.created_at,
        "updated_at": playlist.updated_at,
        "owner": {
            "id": playlist.user.id,
            "username": playlist.user.username,
            "display_name": playlist.user.display_name,
            "avatar_url": playlist.user.avatar_url,
        },
        "tracks": tracks,
    }


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
        .options(
            joinedload(Playlist.user),
            joinedload(Playlist.track_links).joinedload(PlaylistTrack.track),
        )
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


# ========================================
# Static path routes (must be defined before /{playlist_id})
# ========================================


@router.get("/shared", response_model=list[PlaylistOut])
def list_shared_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List playlists shared with the current user (accepted collaborations only).

    Returns:
        List of playlists where user is a collaborator
    """
    # Get accepted collaborations
    collaborations = (
        db.query(PlaylistCollaborator)
        .filter(
            PlaylistCollaborator.user_id == current_user.id,
            PlaylistCollaborator.status == 'accepted'
        )
        .all()
    )

    playlist_ids = [collab.playlist_id for collab in collaborations]

    if not playlist_ids:
        return []

    playlists = (
        db.query(Playlist)
        .options(
            joinedload(Playlist.user),
            joinedload(Playlist.track_links).joinedload(PlaylistTrack.track),
        )
        .filter(Playlist.id.in_(playlist_ids))
        .order_by(Playlist.updated_at.desc())
        .all()
    )

    # Add computed fields and include permission from collaboration
    collab_map = {str(c.playlist_id): c for c in collaborations}
    for playlist in playlists:
        _add_computed_fields(playlist)
        # Add permission info for frontend
        collab = collab_map.get(str(playlist.id))
        playlist.permission = collab.permission if collab else None

    return playlists


@router.get("/invitations", response_model=list[dict])
def list_my_invitations(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List invitations for the current user.

    Args:
        status_filter: Optional filter ('pending', 'accepted', 'rejected')

    Returns:
        List of invitations with playlist info
    """
    query = (
        db.query(PlaylistCollaborator)
        .options(
            joinedload(PlaylistCollaborator.playlist).joinedload(Playlist.user),
            joinedload(PlaylistCollaborator.inviter)
        )
        .filter(PlaylistCollaborator.user_id == current_user.id)
    )

    if status_filter:
        if status_filter not in ('pending', 'accepted', 'rejected'):
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(PlaylistCollaborator.status == status_filter)

    invitations = query.order_by(PlaylistCollaborator.invited_at.desc()).all()

    result = []
    for inv in invitations:
        result.append({
            "id": str(inv.id),
            "playlist": {
                "id": str(inv.playlist.id),
                "name": inv.playlist.name,
                "description": inv.playlist.description,
                "owner": {
                    "id": inv.playlist.user.id,
                    "username": inv.playlist.user.username,
                    "display_name": inv.playlist.user.display_name,
                    "avatar_url": inv.playlist.user.avatar_url,
                }
            },
            "permission": inv.permission,
            "status": inv.status,
            "invited_at": inv.invited_at,
            "accepted_at": inv.accepted_at,
            "inviter": {
                "username": inv.inviter.username,
                "display_name": inv.inviter.display_name,
            } if inv.inviter else None
        })

    return result


@router.put("/invitations/{invitation_id}", response_model=dict)
def respond_to_invitation(
    invitation_id: str,
    response: PlaylistInviteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept or reject a playlist invitation.

    Args:
        invitation_id: Invitation UUID
        response: Status ('accepted' or 'rejected')

    Returns:
        Updated invitation

    Raises:
        404: Invitation not found
        400: Invalid status or invitation already processed
    """
    invitation = (
        db.query(PlaylistCollaborator)
        .options(
            joinedload(PlaylistCollaborator.playlist).joinedload(Playlist.user),
            joinedload(PlaylistCollaborator.inviter)
        )
        .filter(
            PlaylistCollaborator.id == invitation_id,
            PlaylistCollaborator.user_id == current_user.id
        )
        .first()
    )

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.status != 'pending':
        raise HTTPException(status_code=400, detail="Invitation already processed")

    invitation.status = response.status
    if response.status == 'accepted':
        invitation.accepted_at = datetime.utcnow()

    db.commit()
    db.refresh(invitation)

    return {
        "id": str(invitation.id),
        "status": invitation.status,
        "accepted_at": invitation.accepted_at,
        "message": f"Invitation {response.status}"
    }


# ========================================
# Dynamic path routes (/{playlist_id} catches all unmatched paths)
# ========================================


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
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.artist_links)
                .joinedload(TrackArtist.artist),
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.album_links)
                .joinedload(TrackAlbum.album),
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.dance_styles),
        )
        .filter(Playlist.id == playlist_id)
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Check permissions (public OR user has access)
    from app.api.playlists.permissions import can_view_playlist
    if not can_view_playlist(playlist, current_user, db):
        raise HTTPException(
            status_code=403, detail="You do not have access to this playlist"
        )

    return _serialize_playlist_detail(playlist)


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
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.artist_links)
                .joinedload(TrackArtist.artist),
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.album_links)
                .joinedload(TrackAlbum.album),
            joinedload(Playlist.track_links)
                .joinedload(PlaylistTrack.track)
                .joinedload(Track.dance_styles),
        )
        .filter(Playlist.share_token == share_token, Playlist.is_public == True)
        .first()
    )

    if not playlist:
        raise HTTPException(
            status_code=404, detail="Playlist not found or not public"
        )

    return _serialize_playlist_detail(playlist)


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

    Requires edit permission (owner or collaborator with edit access).

    Args:
        playlist_id: Playlist UUID
        track_data: Track ID and optional position

    Returns:
        Success message with position

    Raises:
        404: Playlist or track not found
        403: Insufficient permissions
        400: Track already in playlist
    """
    # Verify access and edit permission
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Require edit permission (owner or collaborator with edit permission)
    require_permission(playlist, current_user, 'edit', db)

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

    Requires edit permission (owner or collaborator with edit access).

    Args:
        playlist_id: Playlist UUID
        track_id: Track UUID

    Raises:
        404: Playlist or track not found
        403: Insufficient permissions
    """
    # Verify access and edit permission
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Require edit permission
    require_permission(playlist, current_user, 'edit', db)

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

    Requires edit permission (owner or collaborator with edit access).

    Args:
        playlist_id: Playlist UUID
        reorder: Track ID and new position

    Returns:
        Success message with new position

    Raises:
        404: Playlist or track not found
        403: Insufficient permissions
    """
    # Verify access and edit permission
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Require edit permission
    require_permission(playlist, current_user, 'edit', db)

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


# ========================================
# Playlist Collaboration Endpoints
# ========================================


@router.post("/{playlist_id}/collaborators", response_model=PlaylistCollaboratorOut, status_code=status.HTTP_201_CREATED)
def invite_collaborator(
    playlist_id: str,
    invite_data: PlaylistInviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Invite a user to collaborate on a playlist (owner only).

    Args:
        playlist_id: Playlist UUID
        invite_data: Username and permission level

    Returns:
        Created collaboration invitation

    Raises:
        404: Playlist not found or user not found
        403: Not playlist owner
        400: Cannot invite self or duplicate invitation
    """
    # Verify ownership
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if not is_owner(playlist, current_user):
        raise HTTPException(status_code=403, detail="Only playlist owner can invite collaborators")

    # Find invited user by username
    invited_user = db.query(User).filter(func.lower(User.username) == invite_data.username.lower()).first()
    if not invited_user:
        raise HTTPException(status_code=404, detail=f"User '@{invite_data.username}' not found")

    # Cannot invite self
    if invited_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Check for existing collaboration
    existing = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist_id,
        PlaylistCollaborator.user_id == invited_user.id
    ).first()

    if existing:
        if existing.status == 'rejected':
            # Resend invitation
            existing.status = 'pending'
            existing.invited_at = datetime.utcnow()
            existing.accepted_at = None
            existing.permission = invite_data.permission.value
            db.commit()
            db.refresh(existing)
            collaboration = existing
        else:
            raise HTTPException(status_code=400, detail="User already invited or is a collaborator")
    else:
        # Create new invitation
        collaboration = PlaylistCollaborator(
            playlist_id=playlist_id,
            user_id=invited_user.id,
            permission=invite_data.permission.value,
            invited_by=current_user.id,
            status='pending'
        )
        db.add(collaboration)
        db.commit()
        db.refresh(collaboration)

    # Load relationships for response
    collaboration.user = invited_user
    collaboration.invited_by_username = current_user.username

    return PlaylistCollaboratorOut(
        id=str(collaboration.id),
        user=CollaboratorUserOut.from_orm(invited_user),
        permission=collaboration.permission,
        status=collaboration.status,
        invited_at=collaboration.invited_at,
        accepted_at=collaboration.accepted_at,
        invited_by_username=current_user.username
    )


@router.get("/{playlist_id}/collaborators", response_model=list[PlaylistCollaboratorOut])
def list_collaborators(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all collaborators for a playlist (owner only).

    Args:
        playlist_id: Playlist UUID

    Returns:
        List of collaborators with status and permissions

    Raises:
        404: Playlist not found
        403: Not playlist owner
    """
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if not is_owner(playlist, current_user):
        raise HTTPException(status_code=403, detail="Only playlist owner can view collaborators")

    collaborations = (
        db.query(PlaylistCollaborator)
        .options(
            joinedload(PlaylistCollaborator.user),
            joinedload(PlaylistCollaborator.inviter)
        )
        .filter(PlaylistCollaborator.playlist_id == playlist_id)
        .order_by(PlaylistCollaborator.invited_at.desc())
        .all()
    )

    result = []
    for collab in collaborations:
        result.append(PlaylistCollaboratorOut(
            id=str(collab.id),
            user=CollaboratorUserOut.from_orm(collab.user),
            permission=collab.permission,
            status=collab.status,
            invited_at=collab.invited_at,
            accepted_at=collab.accepted_at,
            invited_by_username=collab.inviter.username if collab.inviter else None
        ))

    return result


@router.put("/{playlist_id}/collaborators/{collaborator_id}", response_model=PlaylistCollaboratorOut)
def update_collaborator_permission(
    playlist_id: str,
    collaborator_id: str,
    permission: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a collaborator's permission level (owner only).

    Args:
        playlist_id: Playlist UUID
        collaborator_id: Collaboration UUID
        permission: New permission level ('view' or 'edit')

    Returns:
        Updated collaboration

    Raises:
        404: Playlist or collaboration not found
        403: Not playlist owner
        400: Invalid permission level
    """
    if permission not in ('view', 'edit'):
        raise HTTPException(status_code=400, detail="Permission must be 'view' or 'edit'")

    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if not is_owner(playlist, current_user):
        raise HTTPException(status_code=403, detail="Only playlist owner can update permissions")

    collaboration = (
        db.query(PlaylistCollaborator)
        .options(
            joinedload(PlaylistCollaborator.user),
            joinedload(PlaylistCollaborator.inviter)
        )
        .filter(
            PlaylistCollaborator.id == collaborator_id,
            PlaylistCollaborator.playlist_id == playlist_id
        )
        .first()
    )

    if not collaboration:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    collaboration.permission = permission
    db.commit()
    db.refresh(collaboration)

    return PlaylistCollaboratorOut(
        id=str(collaboration.id),
        user=CollaboratorUserOut.from_orm(collaboration.user),
        permission=collaboration.permission,
        status=collaboration.status,
        invited_at=collaboration.invited_at,
        accepted_at=collaboration.accepted_at,
        invited_by_username=collaboration.inviter.username if collaboration.inviter else None
    )


@router.delete("/{playlist_id}/collaborators/{collaborator_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_collaborator(
    playlist_id: str,
    collaborator_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a collaborator from a playlist (owner or self).

    Args:
        playlist_id: Playlist UUID
        collaborator_id: Collaboration UUID

    Raises:
        404: Playlist or collaboration not found
        403: Not authorized (must be owner or the collaborator themselves)
    """
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    collaboration = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.id == collaborator_id,
        PlaylistCollaborator.playlist_id == playlist_id
    ).first()

    if not collaboration:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    # Allow owner or the collaborator themselves to remove
    if not (is_owner(playlist, current_user) or collaboration.user_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to remove this collaborator")

    db.delete(collaboration)
    db.commit()
    return None
