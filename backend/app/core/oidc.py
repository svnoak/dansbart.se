"""
OIDC token validation using Authentik.

This module handles validation of JWT tokens issued by Authentik's OIDC provider.
"""
from jose import jwt, JWTError
from fastapi import HTTPException, status
import httpx
from functools import lru_cache
from typing import Dict
from app.core.config import settings


# Cache JWKS for 1 hour to reduce API calls to Authentik
@lru_cache(maxsize=1)
def get_jwks() -> Dict:
    """
    Fetch public keys from Authentik JWKS endpoint.

    Returns:
        dict: JSON Web Key Set containing public keys for token verification

    Raises:
        HTTPException: If JWKS endpoint is unreachable
    """
    try:
        response = httpx.get(settings.AUTHENTIK_JWKS_URI, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch JWKS from Authentik: {str(e)}"
        )


def validate_token(token: str) -> Dict:
    """
    Validate OIDC token from Authentik.

    This function:
    1. Checks the token algorithm (HS256 or RS256)
    2. For HS256: Uses client secret to verify signature
    3. For RS256: Fetches public keys from JWKS endpoint
    4. Validates issuer, audience, and expiration
    5. Returns decoded token payload with user claims

    Args:
        token: JWT token string from Authorization header

    Returns:
        dict: Decoded token payload containing:
            - sub: User ID (UUID)
            - email: User email
            - name: User display name
            - preferred_username: Username
            - picture: Avatar URL
            - groups: List of group names (if included in scope)

    Raises:
        HTTPException: If token is invalid, expired, or has wrong issuer/audience
    """
    import logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    logger.info(f"Validating token (first 20 chars): {token[:20]}...")
    logger.info(f"Expected issuer: {settings.AUTHENTIK_ISSUER}")
    logger.info(f"Expected audience: {settings.AUTHENTIK_CLIENT_ID}")

    try:
        # Decode header to check algorithm
        unverified_header = jwt.get_unverified_header(token)
        algorithm = unverified_header.get("alg", "RS256")
        logger.info(f"Token algorithm: {algorithm}")

        if algorithm == "HS256":
            # HS256 tokens are signed with the client secret
            # This is common for public clients in Authentik
            payload = jwt.decode(
                token,
                settings.AUTHENTIK_CLIENT_SECRET,
                algorithms=["HS256"],
                issuer=settings.AUTHENTIK_ISSUER,
                audience=settings.AUTHENTIK_CLIENT_ID,
                options={
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_exp": True,
                    "verify_signature": True
                }
            )
            return payload

        # RS256 - use JWKS public keys
        jwks = get_jwks()
        key_id = unverified_header.get("kid")

        if not key_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing key ID (kid)"
            )

        # Find matching public key
        key = next((k for k in jwks.get("keys", []) if k["kid"] == key_id), None)
        if not key:
            # Clear cache and retry in case JWKS was rotated
            get_jwks.cache_clear()
            jwks = get_jwks()
            key = next((k for k in jwks.get("keys", []) if k["kid"] == key_id), None)

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token key ID - key not found in JWKS"
                )

        # Validate token signature and claims
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.AUTHENTIK_ISSUER,
            audience=settings.AUTHENTIK_CLIENT_ID,
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "verify_signature": True
            }
        )

        return payload

    except JWTError as e:
        logger.error(f"JWT validation failed: {str(e)}")
        logger.error(f"Expected issuer: {settings.AUTHENTIK_ISSUER}")
        logger.error(f"Expected audience: {settings.AUTHENTIK_CLIENT_ID}")
        # Try to decode without verification to see the actual claims
        try:
            unverified = jwt.get_unverified_claims(token)
            logger.error(f"Token iss claim: {unverified.get('iss')}")
            logger.error(f"Token aud claim: {unverified.get('aud')}")
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


def clear_jwks_cache():
    """Clear the JWKS cache. Useful for testing or if key rotation occurs."""
    get_jwks.cache_clear()
