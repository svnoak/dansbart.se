"""
Base Repository Pattern with Common Query Optimization Patterns

Provides:
- Generic CRUD operations
- Optimized pagination with eager loading
- Batch operations
- Query filtering helpers
- Performance monitoring hooks
"""
import uuid
from typing import TypeVar, Generic, Type, Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, Query, joinedload, selectinload
from sqlalchemy import func, select
from app.core.database import Base

T = TypeVar('T', bound=Base)


class BaseRepository(Generic[T]):
    """
    Generic repository base class providing common database operations.

    Usage:
        class ArtistRepository(BaseRepository[Artist]):
            def __init__(self, db: Session):
                super().__init__(db, Artist)
    """

    def __init__(self, db: Session, model: Type[T]):
        self.db = db
        self.model = model

    # ==================== BASIC CRUD ====================

    def get_by_id(self, entity_id: uuid.UUID, eager_load: List = None) -> Optional[T]:
        """Get entity by ID with optional eager loading."""
        query = self.db.query(self.model).filter(self.model.id == entity_id)

        if eager_load:
            query = query.options(*eager_load)

        return query.first()

    def get_all(self, eager_load: List = None, order_by=None) -> List[T]:
        """Get all entities with optional eager loading and ordering."""
        query = self.db.query(self.model)

        if eager_load:
            query = query.options(*eager_load)

        if order_by is not None:
            query = query.order_by(order_by)

        return query.all()

    def create(self, **kwargs) -> T:
        """Create a new entity."""
        entity = self.model(**kwargs)
        self.db.add(entity)
        self.db.flush()
        return entity

    def update(self, entity: T, **kwargs) -> T:
        """Update an existing entity."""
        for key, value in kwargs.items():
            setattr(entity, key, value)
        self.db.flush()
        return entity

    def delete(self, entity: T) -> None:
        """Delete an entity."""
        self.db.delete(entity)
        self.db.flush()

    def delete_by_id(self, entity_id: uuid.UUID) -> bool:
        """Delete entity by ID. Returns True if deleted, False if not found."""
        entity = self.get_by_id(entity_id)
        if entity:
            self.delete(entity)
            return True
        return False

    def commit(self):
        """Commit the current transaction."""
        self.db.commit()

    def rollback(self):
        """Rollback the current transaction."""
        self.db.rollback()

    def flush(self):
        """Flush pending changes without committing."""
        self.db.flush()

    # ==================== BATCH OPERATIONS ====================

    def bulk_create(self, entities_data: List[Dict[str, Any]]) -> List[T]:
        """Create multiple entities in a single transaction."""
        entities = [self.model(**data) for data in entities_data]
        self.db.add_all(entities)
        self.db.flush()
        return entities

    def bulk_delete(self, entity_ids: List[uuid.UUID]) -> int:
        """Delete multiple entities by ID. Returns count of deleted entities."""
        count = self.db.query(self.model).filter(
            self.model.id.in_(entity_ids)
        ).delete(synchronize_session=False)
        self.db.flush()
        return count

    # ==================== QUERY BUILDING HELPERS ====================

    def _build_base_query(self, eager_load: List = None) -> Query:
        """Build a base query with optional eager loading."""
        query = self.db.query(self.model)

        if eager_load:
            query = query.options(*eager_load)

        return query

    def _apply_filters(self, query: Query, filters: Dict[str, Any]) -> Query:
        """Apply multiple filters to a query."""
        for key, value in filters.items():
            if value is not None:
                column = getattr(self.model, key)
                query = query.filter(column == value)
        return query

    def _apply_search(self, query: Query, search_term: str, search_fields: List[str]) -> Query:
        """Apply case-insensitive search across multiple fields."""
        if not search_term:
            return query

        conditions = []
        for field in search_fields:
            column = getattr(self.model, field)
            conditions.append(column.ilike(f"%{search_term}%"))

        if conditions:
            query = query.filter(func.or_(*conditions))

        return query

    # ==================== PAGINATION ====================

    def paginate(
        self,
        limit: int = 50,
        offset: int = 0,
        filters: Dict[str, Any] = None,
        search: str = None,
        search_fields: List[str] = None,
        order_by = None,
        eager_load: List = None
    ) -> Tuple[List[T], int]:
        """
        Paginate query results with filtering and eager loading.

        Returns:
            Tuple of (items, total_count)
        """
        query = self._build_base_query(eager_load=eager_load)

        # Apply filters
        if filters:
            query = self._apply_filters(query, filters)

        # Apply search
        if search and search_fields:
            query = self._apply_search(query, search, search_fields)

        # Get total count BEFORE pagination
        total = query.count()

        # Apply ordering
        if order_by is not None:
            query = query.order_by(order_by)

        # Apply pagination
        items = query.offset(offset).limit(limit).all()

        return items, total

    def build_paginated_response(
        self,
        items: List[Any],
        total: int,
        limit: int,
        offset: int
    ) -> Dict[str, Any]:
        """Build standardized paginated response."""
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total
        }

    # ==================== EXISTENCE CHECKS ====================

    def exists(self, **filters) -> bool:
        """Check if entity exists with given filters."""
        query = self.db.query(self.model.id)
        query = self._apply_filters(query, filters)
        return query.first() is not None

    def count(self, filters: Dict[str, Any] = None) -> int:
        """Count entities with optional filters."""
        query = self.db.query(func.count(self.model.id))

        if filters:
            query = self._apply_filters(query, filters)

        return query.scalar()

    # ==================== FIRST/FIND OPERATIONS ====================

    def find_one(self, filters: Dict[str, Any], eager_load: List = None) -> Optional[T]:
        """Find a single entity matching filters."""
        query = self._build_base_query(eager_load=eager_load)
        query = self._apply_filters(query, filters)
        return query.first()

    def find_all(
        self,
        filters: Dict[str, Any] = None,
        eager_load: List = None,
        order_by = None,
        limit: int = None
    ) -> List[T]:
        """Find all entities matching filters."""
        query = self._build_base_query(eager_load=eager_load)

        if filters:
            query = self._apply_filters(query, filters)

        if order_by is not None:
            query = query.order_by(order_by)

        if limit:
            query = query.limit(limit)

        return query.all()
