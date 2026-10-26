import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, or_, func
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.modules.auth.models import User, Role, RefreshToken


def get_user_by_id(user_id: str | uuid.UUID) -> Optional[User]:
    """Retrieve an active, non-deleted user by primary key with roles and permissions preloaded."""
    if isinstance(user_id, str):
        try:
            user_id = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return None

    stmt = (
        select(User)
        .options(joinedload(User.roles), joinedload(User.permissions))
        .where(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
    )
    return db.session.execute(stmt).unique().scalar_one_or_none()


def get_user_by_email(email: str) -> Optional[User]:
    """Retrieve user by normalized email (case-insensitive and trimmed)."""
    if not email or not isinstance(email, str):
        return None
    normalized_email = email.strip().lower()
    stmt = (
        select(User)
        .options(joinedload(User.roles), joinedload(User.permissions))
        .where(
            func.lower(User.email) == normalized_email,
            User.deleted_at.is_(None),
        )
    )
    return db.session.execute(stmt).unique().scalar_one_or_none()


def get_user_by_identifier(identifier: str) -> Optional[User]:
    """Retrieve user by either email or username (case-insensitive and whitespace-resilient)."""
    if not identifier or not isinstance(identifier, str):
        return None
    norm = identifier.strip().lower()
    single_space_norm = re.sub(r"\s+", " ", norm)
    no_space_norm = re.sub(r"\s+", "", norm)

    stmt = (
        select(User)
        .options(joinedload(User.roles), joinedload(User.permissions))
        .where(
            or_(
                func.lower(User.email) == norm,
                func.lower(User.username) == norm,
                func.lower(User.username) == single_space_norm,
                func.lower(User.username) == no_space_norm,
                func.replace(func.lower(User.username), " ", "") == no_space_norm,
            ),
            User.deleted_at.is_(None),
        )
    )
    return db.session.execute(stmt).unique().scalar_one_or_none()


def get_role_by_name(name: str) -> Optional[Role]:
    """Retrieve role by unique name identifier."""
    stmt = select(Role).where(Role.name == name)
    return db.session.execute(stmt).scalar_one_or_none()


def get_active_refresh_token(token_jti: str) -> Optional[RefreshToken]:
    """Retrieve an active, unrevoked, unexpired refresh token record."""
    now = datetime.now(timezone.utc)
    stmt = select(RefreshToken).where(
        RefreshToken.token_jti == token_jti,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > now,
    )
    return db.session.execute(stmt).scalar_one_or_none()
