"""
Authentication API routes.

Simple endpoints for user authentication. Actual login/registration happens in Authentik.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from app.api.auth.dependencies import get_current_user
from app.core.user_models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserOut(BaseModel):
    """User response model."""
    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user profile from token.

    Returns cached user information from the database.
    Full user management happens in Authentik.
    """
    return UserOut.from_orm(current_user)


@router.post("/logout")
def logout():
    """
    Logout endpoint.

    NOTE: This is just an informational endpoint.
    Actual logout requires:
    1. Client clears tokens from localStorage
    2. Client redirects to Authentik logout URL:
       {AUTHENTIK_ISSUER}/end-session/

    Returns:
        dict: Logout URL for Authentik
    """
    from app.core.config import settings

    return {
        "message": "Clear tokens and redirect to logout_url",
        "logout_url": f"{settings.AUTHENTIK_ISSUER}end-session/"
    }
