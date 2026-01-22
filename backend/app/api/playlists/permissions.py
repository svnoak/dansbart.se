"""
Permission system for playlist collaboration.

Provides utilities for checking user permissions on playlists.
"""
from typing import Literal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.user_models import Playlist, PlaylistCollaborator, User

PermissionLevel = Literal['owner', 'edit', 'view']


def get_user_permission(playlist: Playlist, user: User | None, db: Session) -> PermissionLevel | None:
    """
    Get the user's permission level for a playlist.

    Returns:
        'owner' - User owns the playlist (full control)
        'edit' - User has edit permission (can add/remove/reorder tracks)
        'view' - User has view permission (read-only)
        None - User has no access
    """
    if user is None:
        return None

    # Owner has full control
    if playlist.user_id == user.id:
        return 'owner'

    # Check for collaboration
    collaboration = db.query(PlaylistCollaborator).filter(
        PlaylistCollaborator.playlist_id == playlist.id,
        PlaylistCollaborator.user_id == user.id,
        PlaylistCollaborator.status == 'accepted'
    ).first()

    if collaboration:
        return collaboration.permission  # type: ignore

    return None


def can_view_playlist(playlist: Playlist, user: User | None, db: Session) -> bool:
    """Check if user can view the playlist (public or has permission)."""
    # Public playlists are viewable by anyone
    if playlist.is_public:
        return True

    # Check user permission
    permission = get_user_permission(playlist, user, db)
    return permission in ('owner', 'edit', 'view')


def can_edit_playlist(playlist: Playlist, user: User | None, db: Session) -> bool:
    """Check if user can edit the playlist (owner or has edit permission)."""
    if user is None:
        return False

    permission = get_user_permission(playlist, user, db)
    return permission in ('owner', 'edit')


def is_owner(playlist: Playlist, user: User | None) -> bool:
    """Check if user is the owner of the playlist."""
    if user is None:
        return False

    return playlist.user_id == user.id


def require_permission(
    playlist: Playlist,
    user: User | None,
    required: PermissionLevel,
    db: Session
) -> None:
    """
    Require a specific permission level, raise 403 if insufficient.

    Args:
        playlist: The playlist to check
        user: The current user (can be None)
        required: The required permission level ('owner', 'edit', or 'view')
        db: Database session

    Raises:
        HTTPException: 403 if user lacks required permission
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication required"
        )

    user_permission = get_user_permission(playlist, user, db)

    # Map permissions to hierarchy (owner > edit > view)
    permission_hierarchy = {'view': 1, 'edit': 2, 'owner': 3}

    if user_permission is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this playlist"
        )

    required_level = permission_hierarchy.get(required, 0)
    user_level = permission_hierarchy.get(user_permission, 0)

    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You need {required} permission for this action"
        )
