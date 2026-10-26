from functools import wraps
from typing import Callable, List
from flask import g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.common.errors.exceptions import AuthenticationError, ForbiddenError
from app.common.permissions.authorization import AuthorizationEvaluator
from app.modules.auth.selectors import get_user_by_id


def require_auth(func: Callable) -> Callable:
    """Decorator ensuring request has a valid JWT and injects active user into flask.g."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            raise AuthenticationError(f"Invalid or missing authentication token: {str(e)}")

        user_id = get_jwt_identity()
        if not user_id:
            raise AuthenticationError("Malformed token identity")

        user = get_user_by_id(user_id)
        if not user or not user.is_active or user.deleted_at is not None:
            raise AuthenticationError("User account is inactive or no longer exists")

        if getattr(user, "approval_status", "APPROVED") != "APPROVED":
            raise AuthenticationError("User account is pending approval or has been disabled.")

        g.current_user = user
        return func(*args, **kwargs)
    return wrapper


def require_roles(*roles: str) -> Callable:
    """Decorator requiring the authenticated user to possess at least one of the specified roles."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        @require_auth
        def wrapper(*args, **kwargs):
            user = g.current_user
            if not AuthorizationEvaluator.has_required_role(user, list(roles)):
                raise ForbiddenError(
                    f"Action requires one of the following roles: {', '.join(roles)}"
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(permission: str) -> Callable:
    """Decorator requiring the authenticated user to possess the specified permission scope."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        @require_auth
        def wrapper(*args, **kwargs):
            user = g.current_user
            if not AuthorizationEvaluator.has_required_permission(user, permission):
                raise ForbiddenError(f"Missing required permission: '{permission}'")
            return func(*args, **kwargs)
        return wrapper
    return decorator
