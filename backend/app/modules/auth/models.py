import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Index,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(db.Model):
    """Association model linking users to roles."""

    __tablename__ = "user_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    def __init__(
        self,
        user_id: uuid.UUID,
        role_id: uuid.UUID,
        **kwargs: Any,
    ):
        self.user_id = user_id
        self.role_id = role_id
        for k, v in kwargs.items():
            setattr(self, k, v)


class Role(db.Model):
    """System RBAC Role definition."""

    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        secondary="user_roles",
        back_populates="roles",
    )

    def __init__(
        self,
        name: str,
        description: Optional[str] = None,
        **kwargs: Any,
    ):
        self.name = name
        self.description = description
        for k, v in kwargs.items():
            setattr(self, k, v)


class UserPermission(db.Model):
    """Association model linking users to dynamic permission definitions."""

    __tablename__ = "user_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    def __init__(
        self,
        user_id: uuid.UUID,
        permission_id: uuid.UUID,
        **kwargs: Any,
    ):
        self.user_id = user_id
        self.permission_id = permission_id
        for k, v in kwargs.items():
            setattr(self, k, v)


class Permission(db.Model):
    """System dynamic permission definition."""

    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        secondary="user_permissions",
        back_populates="permissions",
    )

    def __init__(
        self,
        code: str,
        name: str,
        category: str,
        description: Optional[str] = None,
        **kwargs: Any,
    ):
        self.code = code
        self.name = name
        self.category = category
        self.description = description
        for k, v in kwargs.items():
            setattr(self, k, v)


APPROVAL_STATUS_PENDING = "PENDING_APPROVAL"
APPROVAL_STATUS_APPROVED = "APPROVED"
APPROVAL_STATUS_DISABLED = "DISABLED"


class User(db.Model):
    """Primary User model for Candidate Enrollment Form (CEF) Portal."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approval_status: Mapped[str] = mapped_column(
        String(30),
        default=APPROVAL_STATUS_PENDING,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Relationships
    roles: Mapped[List["Role"]] = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
        lazy="selectin",
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
    )
    permissions: Mapped[List["Permission"]] = relationship(
        "Permission",
        secondary="user_permissions",
        back_populates="users",
        lazy="selectin",
    )

    def __init__(
        self,
        email: str,
        password_hash: str,
        first_name: str,
        last_name: str,
        username: Optional[str] = None,
        is_active: bool = True,
        is_verified: bool = False,
        approval_status: str = APPROVAL_STATUS_PENDING,
        **kwargs: Any,
    ):
        self.email = email
        self.password_hash = password_hash
        self.first_name = first_name
        self.last_name = last_name
        self.username = username
        self.is_active = is_active
        self.is_verified = is_verified
        self.approval_status = approval_status
        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def role_names(self) -> List[str]:
        return [r.name for r in self.roles]

    @property
    def permission_codes(self) -> List[str]:
        """Return the user's active dynamic permissions from database."""
        # 1. Super Administrator possesses all system and operational permissions
        if "admin" in self.role_names:
            from app.modules.auth.permissions import ROLE_PERMISSIONS, ROLE_SUPER_ADMIN
            return sorted(list(set(ROLE_PERMISSIONS.get(ROLE_SUPER_ADMIN, []))))

        # 2. Dynamic permissions assigned explicitly to this user in user_permissions
        perms = {p.code for p in self.permissions} if self.permissions else set()
        if perms:
            return sorted(list(perms))

        # 3. Fallback to default role permissions ONLY for self-registered applicants without custom assignments
        if "candidate" in self.role_names:
            from app.modules.auth.permissions import get_default_permissions_for_roles
            return sorted(list(get_default_permissions_for_roles(["candidate"])))

        return []


class RefreshToken(db.Model):
    """Storage and revocation tracking for issued JWT refresh tokens."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_jti: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        Index("idx_refresh_tokens_user_expiry", "user_id", "expires_at"),
    )

    def __init__(
        self,
        user_id: uuid.UUID,
        token_jti: str,
        expires_at: datetime,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        **kwargs: Any,
    ):
        self.user_id = user_id
        self.token_jti = token_jti
        self.expires_at = expires_at
        self.user_agent = user_agent
        self.ip_address = ip_address
        for k, v in kwargs.items():
            setattr(self, k, v)


class AuditLog(db.Model):
    """Audit log tracking sensitive actions and enrollment security events."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    def __init__(
        self,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        resource: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Any] = None,
        **kwargs: Any,
    ):
        self.action = action
        self.user_id = user_id
        self.resource = resource
        self.resource_id = resource_id
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.details = details
        for k, v in kwargs.items():
            setattr(self, k, v)
