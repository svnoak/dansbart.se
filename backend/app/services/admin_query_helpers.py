from sqlalchemy.orm import joinedload, selectinload
from app.core.models import Track, TrackArtist, TrackAlbum, Album


# Pre-configured eager loading options
TRACK_EAGER_LOAD = [
    joinedload(Track.dance_styles),
    joinedload(Track.artist_links).joinedload(TrackArtist.artist),
    selectinload(Track.album_links).joinedload(TrackAlbum.album)
]

ALBUM_EAGER_LOAD = [
    joinedload(Album.artist)
]


def build_paginated_response(items: list, total: int, limit: int, offset: int) -> dict:
    """
    Generic paginated response builder.

    Args:
        items: List of items (already formatted)
        total: Total count of items
        limit: Items per page
        offset: Offset for pagination

    Returns:
        Dict with standardized pagination structure
    """
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }
