"""
Rejection Repository - Optimized queries for blocklist management

Provides:
- Rejection CRUD operations
- Blocklist checking
- Entity type filtering
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.core.models import RejectionLog
from .base import BaseRepository


class RejectionRepository(BaseRepository[RejectionLog]):
    """Repository for RejectionLog entity (blocklist management)."""

    def __init__(self, db: Session):
        super().__init__(db, RejectionLog)

    # ==================== BLOCKLIST OPERATIONS ====================

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
        Returns existing rejection if already blocked.

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
        # Check if already blocked
        existing = self.get_by_spotify_id(spotify_id, entity_type)
        if existing:
            return existing

        # Create new rejection log
        return self.create(
            entity_type=entity_type,
            spotify_id=spotify_id,
            entity_name=name,
            reason=reason,
            additional_data=additional_data or {},
            deleted_content=deleted_content
        )

    def is_blocked(self, spotify_id: str, entity_type: str) -> bool:
        """
        Check if an entity is in the rejection blocklist.

        Args:
            spotify_id: Spotify ID to check
            entity_type: 'track', 'artist', or 'album'

        Returns:
            True if blocked, False otherwise
        """
        return self.exists(spotify_id=spotify_id, entity_type=entity_type)

    def get_by_spotify_id(
        self,
        spotify_id: str,
        entity_type: str = None
    ) -> Optional[RejectionLog]:
        """
        Get rejection by Spotify ID and optional entity type.

        Args:
            spotify_id: Spotify ID to lookup
            entity_type: Optional entity type filter

        Returns:
            RejectionLog if found, None otherwise
        """
        filters = {'spotify_id': spotify_id}
        if entity_type:
            filters['entity_type'] = entity_type

        return self.find_one(filters)

    def remove_from_blocklist(self, rejection_id: uuid.UUID) -> Optional[str]:
        """
        Remove an item from the rejection blocklist.

        Args:
            rejection_id: ID of the rejection to remove

        Returns:
            Name of the removed entity, or None if not found
        """
        rejection = self.get_by_id(rejection_id)
        if not rejection:
            return None

        entity_name = rejection.entity_name
        self.delete(rejection)
        return entity_name

    # ==================== PAGINATED QUERIES ====================

    def get_rejections_paginated(
        self,
        entity_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get paginated list of rejections.

        Args:
            entity_type: Optional filter by entity type
            limit: Items per page
            offset: Pagination offset

        Returns:
            Tuple of (rejection_dicts, total_count)
        """
        filters = {}
        if entity_type:
            filters['entity_type'] = entity_type

        rejections, total = self.paginate(
            limit=limit,
            offset=offset,
            filters=filters,
            order_by=RejectionLog.rejected_at.desc()
        )

        # Format results
        items = []
        for rejection in rejections:
            items.append({
                "id": str(rejection.id),
                "entity_type": rejection.entity_type,
                "entity_name": rejection.entity_name,
                "spotify_id": rejection.spotify_id,
                "reason": rejection.reason,
                "rejected_at": rejection.rejected_at.isoformat(),
                "deleted_content": rejection.deleted_content,
                "additional_data": rejection.additional_data
            })

        return items, total

    # ==================== BULK OPERATIONS ====================

    def check_multiple_blocked(
        self,
        spotify_ids: List[str],
        entity_type: str
    ) -> Dict[str, bool]:
        """
        Check multiple Spotify IDs for blocklist status in a single query.
        Optimized for batch operations.

        Args:
            spotify_ids: List of Spotify IDs to check
            entity_type: Entity type to check

        Returns:
            Dict mapping spotify_id to blocked status (True/False)
        """
        if not spotify_ids:
            return {}

        # Query all blocked IDs at once
        blocked_ids = self.db.query(RejectionLog.spotify_id).filter(
            RejectionLog.spotify_id.in_(spotify_ids),
            RejectionLog.entity_type == entity_type
        ).all()

        blocked_set = {spotify_id for (spotify_id,) in blocked_ids}

        # Build result map
        result = {}
        for spotify_id in spotify_ids:
            result[spotify_id] = spotify_id in blocked_set

        return result

    def get_blocked_by_type(self, entity_type: str, limit: int = None) -> List[RejectionLog]:
        """
        Get all blocked entities of a specific type.

        Args:
            entity_type: 'track', 'artist', or 'album'
            limit: Optional limit

        Returns:
            List of RejectionLog entries
        """
        return self.find_all(
            filters={'entity_type': entity_type},
            order_by=RejectionLog.rejected_at.desc(),
            limit=limit
        )

    def count_by_type(self) -> Dict[str, int]:
        """
        Get count of rejections grouped by entity type.

        Returns:
            Dict mapping entity_type to count
        """
        results = self.db.query(
            RejectionLog.entity_type,
            self.db.func.count(RejectionLog.id)
        ).group_by(RejectionLog.entity_type).all()

        return {entity_type: count for entity_type, count in results}

    # ==================== SEARCH ====================

    def search_rejections(
        self,
        search_term: str,
        entity_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Search rejections by entity name.

        Args:
            search_term: Search term to match against entity_name
            entity_type: Optional filter by entity type
            limit: Items per page
            offset: Pagination offset

        Returns:
            Tuple of (rejection_dicts, total_count)
        """
        filters = {}
        if entity_type:
            filters['entity_type'] = entity_type

        rejections, total = self.paginate(
            limit=limit,
            offset=offset,
            filters=filters,
            search=search_term,
            search_fields=['entity_name'],
            order_by=RejectionLog.rejected_at.desc()
        )

        # Format results
        items = []
        for rejection in rejections:
            items.append({
                "id": str(rejection.id),
                "entity_type": rejection.entity_type,
                "entity_name": rejection.entity_name,
                "spotify_id": rejection.spotify_id,
                "reason": rejection.reason,
                "rejected_at": rejection.rejected_at.isoformat(),
                "deleted_content": rejection.deleted_content,
                "additional_data": rejection.additional_data
            })

        return items, total
