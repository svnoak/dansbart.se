"""
Authentication dependencies for FastAPI.

Provides dependency injection for authenticating users via Authentik OIDC tokens.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.core.oidc import validate_token
from app.core.user_models import User
from app.core.config import settings

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get currently authenticated user from OIDC token.

    Flow:
    1. Extract Bearer token from Authorization header
    2. Validate token with Authentik (JWKS)
    3. Get/create user in local database
    4. Update cached user info if changed
    5. Return User object

    Args:
        credentials: HTTP Bearer credentials (Authorization: Bearer <token>)
        db: Database session

    Returns:
        User: Authenticated user object

    Raises:
        HTTPException: If token is invalid or missing required claims
    """
    token = credentials.credentials

    # Validate with Authentik
    payload = validate_token(token)

    # Extract user info from token claims
    # Note: We intentionally do NOT store email to minimize PII/GDPR exposure
    user_id = payload.get("sub")  # Authentik user UUID
    # preferred_username is the Authentik username set during registration
    authentik_username = payload.get("preferred_username")
    display_name = payload.get("name") or authentik_username
    avatar_url = payload.get("picture")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claim (sub)"
        )

    # Get or create user in local database
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        # Use Authentik username if available, otherwise generate one
        username = authentik_username if authentik_username else f"user_{user_id[:8]}"

        # First login - create user record (no email stored)
        user = User(
            id=user_id,
            display_name=display_name,
            avatar_url=avatar_url,
            username=username
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update cached user info if changed
        updated = False
        if user.display_name != display_name:
            user.display_name = display_name
            updated = True
        if user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            updated = True

        # Always update last login
        user.last_login_at = datetime.utcnow()
        updated = True

        if updated:
            db.commit()
            db.refresh(user)

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> User | None:
    """
    Optional authentication dependency - returns None if not authenticated.

    Useful for endpoints that work for both authenticated and anonymous users
    (e.g., public playlist view).

    Args:
        credentials: HTTP Bearer credentials (may be None)
        db: Database session

    Returns:
        User | None: Authenticated user or None if not authenticated
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


async def get_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to require authenticated user with admin group membership.

    Validates that the user:
    1. Has a valid Authentik token
    2. Is a member of the configured admin group (AUTHENTIK_ADMIN_GROUP)

    Args:
        credentials: HTTP Bearer credentials (Authorization: Bearer <token>)
        db: Database session

    Returns:
        User: Authenticated admin user object

    Raises:
        HTTPException: 401 if token invalid, 403 if not in admin group
    """
    # First validate the user is authenticated
    user = await get_current_user(credentials, db)

    # Re-validate token to get the groups claim
    payload = validate_token(credentials.credentials)
    groups = payload.get("groups", [])

    if settings.AUTHENTIK_ADMIN_GROUP not in groups:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user
