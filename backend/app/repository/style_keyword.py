"""
Style Keyword Repository - CRUD operations for style keywords

Provides:
- Keyword CRUD operations
- Uniqueness validation
- Paginated queries for admin UI
- Statistics for dashboard
"""
import uuid
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.models import StyleKeyword
from .base import BaseRepository


class StyleKeywordRepository(BaseRepository[StyleKeyword]):
    """Repository for StyleKeyword entity."""

    def __init__(self, db: Session):
        super().__init__(db, StyleKeyword)

    # ==================== LOOKUP OPERATIONS ====================

    def get_by_keyword(self, keyword: str) -> Optional[StyleKeyword]:
        """Get keyword entry by keyword string (case-insensitive)."""
        return self.db.query(StyleKeyword).filter(
            func.lower(StyleKeyword.keyword) == keyword.lower()
        ).first()

    def keyword_exists(self, keyword: str, exclude_id: uuid.UUID = None) -> bool:
        """
        Check if keyword already exists (for validation).

        Args:
            keyword: Keyword to check
            exclude_id: Optional ID to exclude (for updates)

        Returns:
            True if keyword exists, False otherwise
        """
        query = self.db.query(StyleKeyword.id).filter(
            func.lower(StyleKeyword.keyword) == keyword.lower()
        )
        if exclude_id:
            query = query.filter(StyleKeyword.id != exclude_id)
        return query.first() is not None

    # ==================== ACTIVE KEYWORDS ====================

    def get_active_keywords(self) -> List[StyleKeyword]:
        """
        Get all active keywords, sorted by length (longest first).
        Used by the classifier cache.
        """
        keywords = self.db.query(StyleKeyword).filter(
            StyleKeyword.is_active == True
        ).all()

        # Sort by keyword length descending for proper matching
        return sorted(keywords, key=lambda k: len(k.keyword), reverse=True)

    def get_active_as_dict(self) -> Dict[str, Tuple[str, Optional[str]]]:
        """
        Get active keywords as a dict for the classifier.

        Returns:
            Dict mapping keyword -> (main_style, sub_style)
        """
        keywords = self.get_active_keywords()
        return {
            kw.keyword.lower(): (kw.main_style, kw.sub_style)
            for kw in keywords
        }

    # ==================== CRUD WITH VALIDATION ====================

    def create_keyword(
        self,
        keyword: str,
        main_style: str,
        sub_style: str = None
    ) -> StyleKeyword:
        """
        Create a new style keyword.

        Args:
            keyword: The keyword to match (will be lowercased)
            main_style: Main dance style
            sub_style: Optional sub-style

        Returns:
            Created StyleKeyword

        Raises:
            ValueError: If keyword already exists
        """
        if self.keyword_exists(keyword):
            raise ValueError(f"Keyword '{keyword}' already exists")

        return self.create(
            keyword=keyword.lower().strip(),
            main_style=main_style.strip(),
            sub_style=sub_style.strip() if sub_style else None
        )

    def update_keyword(
        self,
        keyword_id: uuid.UUID,
        keyword: str = None,
        main_style: str = None,
        sub_style: str = None,
        is_active: bool = None
    ) -> Optional[StyleKeyword]:
        """
        Update an existing keyword.

        Args:
            keyword_id: ID of keyword to update
            keyword: New keyword value (optional)
            main_style: New main style (optional)
            sub_style: New sub-style (optional, use empty string to clear)
            is_active: New active status (optional)

        Returns:
            Updated StyleKeyword or None if not found

        Raises:
            ValueError: If new keyword conflicts with existing
        """
        existing = self.get_by_id(keyword_id)
        if not existing:
            return None

        # Check for keyword conflict if changing keyword
        if keyword and keyword.lower() != existing.keyword.lower():
            if self.keyword_exists(keyword, exclude_id=keyword_id):
                raise ValueError(f"Keyword '{keyword}' already exists")

        updates = {}
        if keyword is not None:
            updates['keyword'] = keyword.lower().strip()
        if main_style is not None:
            updates['main_style'] = main_style.strip()
        if sub_style is not None:
            # Empty string clears sub_style
            updates['sub_style'] = sub_style.strip() if sub_style else None
        if is_active is not None:
            updates['is_active'] = is_active

        if updates:
            return self.update(existing, **updates)
        return existing

    # ==================== PAGINATED QUERIES ====================

    def get_keywords_paginated(
        self,
        search: str = None,
        main_style: str = None,
        is_active: bool = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict], int]:
        """
        Get paginated list of keywords with filtering.

        Args:
            search: Search term for keyword/main_style/sub_style
            main_style: Filter by main style
            is_active: Filter by active status
            limit: Items per page
            offset: Pagination offset

        Returns:
            Tuple of (keyword_dicts, total_count)
        """
        filters = {}
        if main_style:
            filters['main_style'] = main_style
        if is_active is not None:
            filters['is_active'] = is_active

        keywords, total = self.paginate(
            limit=limit,
            offset=offset,
            filters=filters,
            search=search,
            search_fields=['keyword', 'main_style', 'sub_style'],
            order_by=StyleKeyword.main_style
        )

        items = []
        for kw in keywords:
            items.append({
                "id": str(kw.id),
                "keyword": kw.keyword,
                "main_style": kw.main_style,
                "sub_style": kw.sub_style,
                "is_active": kw.is_active,
                "created_at": kw.created_at.isoformat() if kw.created_at else None,
                "updated_at": kw.updated_at.isoformat() if kw.updated_at else None
            })

        return items, total

    # ==================== STATISTICS ====================

    def get_style_counts(self) -> Dict[str, int]:
        """
        Get count of keywords per main style.

        Returns:
            Dict mapping main_style -> count
        """
        results = self.db.query(
            StyleKeyword.main_style,
            func.count(StyleKeyword.id)
        ).filter(
            StyleKeyword.is_active == True
        ).group_by(StyleKeyword.main_style).all()

        return {style: count for style, count in results}

    def get_unique_main_styles(self) -> List[str]:
        """
        Get list of unique main styles (for dropdowns).

        Returns:
            Sorted list of unique main style names
        """
        results = self.db.query(StyleKeyword.main_style).distinct().all()
        return sorted([style for (style,) in results])

    def get_unique_sub_styles(self, main_style: str = None) -> List[str]:
        """
        Get list of unique sub-styles, optionally filtered by main style.

        Args:
            main_style: Optional filter by main style

        Returns:
            Sorted list of unique sub-style names (excluding None)
        """
        query = self.db.query(StyleKeyword.sub_style).filter(
            StyleKeyword.sub_style.isnot(None)
        ).distinct()

        if main_style:
            query = query.filter(StyleKeyword.main_style == main_style)

        results = query.all()
        return sorted([sub for (sub,) in results if sub])
