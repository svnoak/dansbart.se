from sqlalchemy.orm import Session
from app.core.models import RejectionLog
from .admin_query_helpers import build_paginated_response


class AdminRejectionService:
    """
    Centralized service for rejection and blocklist operations.
    Eliminates duplication across track/artist/album rejection endpoints.
    """

    def __init__(self, db: Session):
        self.db = db

    def add_to_blocklist(
        self,
        entity_type: str,
        spotify_id: str,
        name: str,
        reason: str,
        additional_data: dict = None
    ) -> RejectionLog:
        """
        Add an entity to the rejection blocklist.

        Args:
            entity_type: 'track', 'artist', or 'album'
            spotify_id: Spotify ID of the entity
            name: Display name of the entity
            reason: Reason for rejection
            additional_data: Optional additional metadata

        Returns:
            Created or existing RejectionLog
        """
        # Check if already blocked
        existing = self.db.query(RejectionLog).filter(
            RejectionLog.spotify_id == spotify_id,
            RejectionLog.entity_type == entity_type
        ).first()

        if existing:
            return existing

        # Create new rejection log
        rejection = RejectionLog(
            entity_type=entity_type,
            spotify_id=spotify_id,
            entity_name=name,
            reason=reason,
            additional_data=additional_data or {}
        )
        self.db.add(rejection)
        self.db.flush()

        return rejection

    def check_if_blocked(self, spotify_id: str, entity_type: str) -> bool:
        """
        Check if an entity is in the rejection blocklist.

        Args:
            spotify_id: Spotify ID to check
            entity_type: 'track', 'artist', or 'album'

        Returns:
            True if blocked, False otherwise
        """
        return self.db.query(RejectionLog).filter(
            RejectionLog.spotify_id == spotify_id,
            RejectionLog.entity_type == entity_type
        ).count() > 0

    def get_rejections_paginated(
        self,
        entity_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of rejections.

        Args:
            entity_type: Optional filter by entity type
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with rejection list
        """
        query = self.db.query(RejectionLog)

        if entity_type:
            query = query.filter(RejectionLog.entity_type == entity_type)

        total = query.count()
        rejections = query.order_by(
            RejectionLog.rejected_at.desc()
        ).offset(offset).limit(limit).all()

        items = []
        for rejection in rejections:
            items.append({
                "id": str(rejection.id),
                "entity_type": rejection.entity_type,
                "entity_name": rejection.entity_name,
                "spotify_id": rejection.spotify_id,
                "reason": rejection.reason,
                "rejected_at": rejection.rejected_at.isoformat(),
                "additional_data": rejection.additional_data
            })

        return build_paginated_response(items, total, limit, offset)

    def remove_from_blocklist(self, rejection_id: str) -> str:
        """
        Remove an item from the rejection blocklist.

        Args:
            rejection_id: ID of the rejection to remove

        Returns:
            Name of the removed entity

        Raises:
            ValueError: If rejection not found
        """
        rejection = self.db.query(RejectionLog).filter(
            RejectionLog.id == rejection_id
        ).first()

        if not rejection:
            raise ValueError("Rejection not found")

        entity_name = rejection.entity_name
        self.db.delete(rejection)
        self.db.flush()

        return entity_name
