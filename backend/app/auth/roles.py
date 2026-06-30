"""Role constants for authorization."""

from __future__ import annotations

ADMIN_ROLES = frozenset({"owner", "admin"})
MANAGER_PLUS_ROLES = frozenset({"owner", "admin", "manager"})
