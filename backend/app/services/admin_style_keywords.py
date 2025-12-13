"""
Admin Style Keywords Service

Provides admin operations for style keyword management.
Handles cache invalidation after mutations.
"""
from sqlalchemy.orm import Session
from app.repository.style_keyword import StyleKeywordRepository
from app.services.style_keywords_cache import invalidate_cache, get_cache_info
from app.services.admin_query_helpers import build_paginated_response


class AdminStyleKeywordService:
    """Service for style keyword admin operations."""

    def __init__(self, db: Session):
        self.db = db
        self.keyword_repo = StyleKeywordRepository(db)

    def get_keywords_paginated(
        self,
        search: str = None,
        main_style: str = None,
        is_active: bool = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get paginated list of keywords.

        Args:
            search: Search term
            main_style: Filter by main style
            is_active: Filter by active status
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response dict
        """
        items, total = self.keyword_repo.get_keywords_paginated(
            search=search,
            main_style=main_style,
            is_active=is_active,
            limit=limit,
            offset=offset
        )
        return build_paginated_response(items, total, limit, offset)

    def create_keyword(
        self,
        keyword: str,
        main_style: str,
        sub_style: str = None
    ) -> dict:
        """
        Create a new keyword.
        Invalidates cache after creation.

        Args:
            keyword: The keyword to match
            main_style: Main dance style
            sub_style: Optional sub-style

        Returns:
            Created keyword dict

        Raises:
            ValueError: If keyword already exists
        """
        kw = self.keyword_repo.create_keyword(keyword, main_style, sub_style)
        self.db.commit()
        invalidate_cache()

        return {
            "id": str(kw.id),
            "keyword": kw.keyword,
            "main_style": kw.main_style,
            "sub_style": kw.sub_style,
            "is_active": kw.is_active
        }

    def update_keyword(
        self,
        keyword_id: str,
        keyword: str = None,
        main_style: str = None,
        sub_style: str = None,
        is_active: bool = None
    ) -> dict:
        """
        Update an existing keyword.
        Invalidates cache after update.

        Args:
            keyword_id: ID of keyword to update
            keyword: New keyword value
            main_style: New main style
            sub_style: New sub-style (empty string clears)
            is_active: New active status

        Returns:
            Updated keyword dict

        Raises:
            ValueError: If keyword not found or conflicts
        """
        import uuid as uuid_module
        kw = self.keyword_repo.update_keyword(
            uuid_module.UUID(keyword_id),
            keyword=keyword,
            main_style=main_style,
            sub_style=sub_style,
            is_active=is_active
        )

        if not kw:
            raise ValueError("Keyword not found")

        self.db.commit()
        invalidate_cache()

        return {
            "id": str(kw.id),
            "keyword": kw.keyword,
            "main_style": kw.main_style,
            "sub_style": kw.sub_style,
            "is_active": kw.is_active
        }

    def delete_keyword(self, keyword_id: str) -> bool:
        """
        Delete a keyword.
        Invalidates cache after deletion.

        Args:
            keyword_id: ID of keyword to delete

        Returns:
            True if deleted, False if not found
        """
        import uuid as uuid_module
        deleted = self.keyword_repo.delete_by_id(uuid_module.UUID(keyword_id))

        if deleted:
            self.db.commit()
            invalidate_cache()

        return deleted

    def get_stats(self) -> dict:
        """
        Get keyword statistics.

        Returns:
            Dict with counts by style, unique styles, total count, and cache info
        """
        return {
            "by_main_style": self.keyword_repo.get_style_counts(),
            "main_styles": self.keyword_repo.get_unique_main_styles(),
            "sub_styles": self.keyword_repo.get_unique_sub_styles(),
            "total": self.keyword_repo.count(),
            "cache": get_cache_info()
        }

    def get_keyword_by_id(self, keyword_id: str) -> dict:
        """
        Get a single keyword by ID.

        Args:
            keyword_id: ID of keyword to fetch

        Returns:
            Keyword dict

        Raises:
            ValueError: If not found
        """
        import uuid as uuid_module
        kw = self.keyword_repo.get_by_id(uuid_module.UUID(keyword_id))

        if not kw:
            raise ValueError("Keyword not found")

        return {
            "id": str(kw.id),
            "keyword": kw.keyword,
            "main_style": kw.main_style,
            "sub_style": kw.sub_style,
            "is_active": kw.is_active,
            "created_at": kw.created_at.isoformat() if kw.created_at else None,
            "updated_at": kw.updated_at.isoformat() if kw.updated_at else None
        }
