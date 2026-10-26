from typing import Any, Dict, List, Optional
from flask import request


class Page:
    """Standardized pagination container."""

    def __init__(
        self,
        items: List[Any],
        page: int,
        per_page: int,
        total: int,
    ):
        self.items = items
        self.page = page
        self.per_page = per_page
        self.total = total
        self.total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        self.has_next = page < self.total_pages
        self.has_prev = page > 1

    def to_meta(self) -> Dict[str, Any]:
        return {
            "page": self.page,
            "per_page": self.per_page,
            "total": self.total,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }


def get_pagination_params(
    default_page: int = 1,
    default_per_page: int = 20,
    max_per_page: int = 100,
) -> tuple[int, int]:
    """Extract and validate page and per_page query parameters."""
    try:
        page = max(1, int(request.args.get("page", default_page)))
    except (ValueError, TypeError):
        page = default_page

    try:
        per_page = min(
            max_per_page,
            max(1, int(request.args.get("per_page", default_per_page))),
        )
    except (ValueError, TypeError):
        per_page = default_per_page

    return page, per_page
