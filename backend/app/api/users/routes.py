"""User management API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.user_models import User
from app.api.auth.dependencies import get_current_user
from app.api.users.schemas import UserOut, UserUpdate, UsernameAvailability, UserSearch
from typing import List


router = APIRouter(prefix="/users", tags=["Users"])


def is_username_available(db: Session, username: str, exclude_user_id: str | None = None) -> bool:
    """Check if username is available (case-insensitive)."""
    query = db.query(User).filter(func.lower(User.username) == username.lower())

    if exclude_user_id:
        query = query.filter(User.id != exclude_user_id)

    return query.count() == 0


@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user profile.

    Returns user information including username.
    """
    return current_user


@router.put("/me", response_model=UserOut)
def update_current_user(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user profile.

    Allows updating username and display_name.
    Username must be unique (case-insensitive).
    """
    # Update username if provided
    if update_data.username is not None:
        # Check if username is available
        if not is_username_available(db, update_data.username, exclude_user_id=current_user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{update_data.username}' is already taken"
            )

        current_user.username = update_data.username

    # Update display_name if provided
    if update_data.display_name is not None:
        current_user.display_name = update_data.display_name

    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/username/available", response_model=UsernameAvailability)
def check_username_availability(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if a username is available.

    Returns availability status (case-insensitive check).
    Excludes current user's username from check.
    """
    if len(username) < 3 or len(username) > 50:
        return UsernameAvailability(available=False, username=username)

    available = is_username_available(db, username, exclude_user_id=current_user.id)

    return UsernameAvailability(available=available, username=username)


@router.get("/search", response_model=List[UserSearch])
def search_users(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search users by username.

    Returns users whose username contains the search term (case-insensitive).
    Limited to 10 results for autocomplete.
    """
    if len(username) < 2:
        return []

    users = db.query(User).filter(
        func.lower(User.username).like(f"%{username.lower()}%")
    ).limit(10).all()

    return users
