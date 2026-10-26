from typing import List, Set, Any
from app.modules.auth.permissions import ROLE_PERMISSIONS, get_default_permissions_for_roles


class AuthorizationEvaluator:
    """Evaluates user roles and dynamic database-driven permissions."""

    @staticmethod
    def get_permissions_for_roles(roles: List[str]) -> Set[str]:
        """Aggregate distinct permission scopes for given role names."""
        return set(get_default_permissions_for_roles(roles))

    @classmethod
    def get_permissions_for_user(cls, user_or_roles: Any) -> Set[str]:
        """Extract set of permission codes for a user object or list of role names."""
        if user_or_roles is None:
            return set()

        # If it's a User model object with dynamic permission_codes property
        if hasattr(user_or_roles, "permission_codes"):
            return set(user_or_roles.permission_codes)

        # If it's a list/set of strings (roles or permission codes)
        if isinstance(user_or_roles, (list, set, tuple)):
            scopes: Set[str] = set()
            for item in user_or_roles:
                if isinstance(item, str):
                    scopes.add(item)
                    scopes.update(get_default_permissions_for_roles([item]))
            return scopes

        return set()

    @classmethod
    def has_required_role(cls, user_or_roles: Any, required_roles: List[str]) -> bool:
        """Check if user has at least one of the required roles or administrative permission."""
        if user_or_roles is None:
            return False

        if hasattr(user_or_roles, "role_names"):
            roles = user_or_roles.role_names
            # If user has admin role or users:manage permission and admin is required
            if "admin" in required_roles:
                perms = set(getattr(user_or_roles, "permission_codes", []))
                if "admin" in roles or "users:manage" in perms:
                    return True
            return any(r in roles for r in required_roles)

        if isinstance(user_or_roles, (list, set, tuple)):
            return any(r in user_or_roles for r in required_roles)

        return False

    @classmethod
    def has_required_permission(cls, user_or_roles: Any, required_permission: str) -> bool:
        """Check if user possesses the requested permission scope."""
        if user_or_roles is None:
            return False

        # Administrator role automatically possesses all operational permission scopes
        if hasattr(user_or_roles, "role_names") and "admin" in (user_or_roles.role_names or []):
            return True
        if hasattr(user_or_roles, "roles") and any(getattr(r, "name", r) == "admin" for r in (user_or_roles.roles or [])):
            return True

        user_permissions = cls.get_permissions_for_user(user_or_roles)

        # Direct match
        if required_permission in user_permissions:
            return True

        # Backward-compatible scope aliases
        if required_permission == "candidates:create" and "candidates:write" in user_permissions:
            return True
        if required_permission == "candidates:edit" and "candidates:write" in user_permissions:
            return True
        if required_permission == "candidates:submit" and "candidates:write" in user_permissions:
            return True
        if required_permission == "candidates:write" and (
            "candidates:create" in user_permissions or "candidates:edit" in user_permissions
        ):
            return True
        if required_permission == "candidates:review" and "documents:verify" in user_permissions:
            return True
        if required_permission == "documents:view" and "documents:verify" in user_permissions:
            return True
        if required_permission == "auth:read" and "portal:access" in user_permissions:
            return True
        if required_permission == "portal:access" and "auth:read" in user_permissions:
            return True

        return False
