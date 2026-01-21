"""User API schemas."""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re


class UserOut(BaseModel):
    """User response model.

    Note: Email is intentionally NOT included - it stays in Authentik only
    to minimize PII exposure and GDPR compliance issues.
    """
    id: str
    display_name: str | None
    username: str
    avatar_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """User update request."""
    username: str | None = Field(None, min_length=3, max_length=50)
    display_name: str | None = Field(None, max_length=100)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None:
            return v

        # Check format: alphanumeric + underscore only
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')

        return v


class UsernameAvailability(BaseModel):
    """Username availability check response."""
    available: bool
    username: str


class UserSearch(BaseModel):
    """User search result.

    Note: Email is intentionally NOT included for privacy.
    """
    id: str
    display_name: str | None
    username: str
    avatar_url: str | None

    class Config:
        from_attributes = True
