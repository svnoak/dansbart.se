from sqlalchemy.orm import Session
from app.core.models import RejectionLog
from app.repository.rejection import RejectionRepository
from .admin_query_helpers import build_paginated_response


class AdminRejectionService:
    """
    Centralized service for rejection and blocklist operations (using repositories).
    Eliminates duplication across track/artist/album rejection endpoints.
    """

    def __init__(self, db: Session):
        self.db = db
        self.rejection_repo = RejectionRepository(db)

    def add_to_blocklist(
        self,
        entity_type: str,
        spotify_id: str,
        name: str,
        reason: str,
        additional_data: dict = None,
        deleted_content: bool = True
    ) -> RejectionLog:
        """
        Add an entity to the rejection blocklist.
        Delegated to RejectionRepository.

        Args:
            entity_type: 'track', 'artist', or 'album'
            spotify_id: Spotify ID of the entity
            name: Display name of the entity
            reason: Reason for rejection
            additional_data: Optional additional metadata
            deleted_content: Whether content was deleted (True) or just blocked (False)

        Returns:
            Created or existing RejectionLog
        """
        return self.rejection_repo.add_to_blocklist(
            entity_type=entity_type,
            spotify_id=spotify_id,
            name=name,
            reason=reason,
            additional_data=additional_data,
            deleted_content=deleted_content
        )

    def check_if_blocked(self, spotify_id: str, entity_type: str) -> bool:
        """
        Check if an entity is in the rejection blocklist.
        Delegated to RejectionRepository.

        Args:
            spotify_id: Spotify ID to check
            entity_type: 'track', 'artist', or 'album'

        Returns:
            True if blocked, False otherwise
        """
        return self.rejection_repo.is_blocked(spotify_id, entity_type)

    def get_rejections_paginated(
        self,
        entity_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of rejections.
        Delegated to RejectionRepository.

        Args:
            entity_type: Optional filter by entity type
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with rejection list
        """
        items, total = self.rejection_repo.get_rejections_paginated(
            entity_type=entity_type,
            limit=limit,
            offset=offset
        )

        return build_paginated_response(items, total, limit, offset)

    def remove_from_blocklist(self, rejection_id: str) -> str:
        """
        Remove an item from the rejection blocklist.
        Delegated to RejectionRepository.

        Args:
            rejection_id: ID of the rejection to remove

        Returns:
            Name of the removed entity

        Raises:
            ValueError: If rejection not found
        """
        import uuid
        entity_name = self.rejection_repo.remove_from_blocklist(uuid.UUID(rejection_id))

        if not entity_name:
            raise ValueError("Rejection not found")

        return entity_name
