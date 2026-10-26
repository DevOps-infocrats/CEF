import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy import select
from app.extensions import db
from app.common.database.transactions import atomic
from app.common.errors.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.modules.auth.models import (
    User,
    Role,
    RefreshToken,
    AuditLog,
    Permission,
    UserPermission,
    APPROVAL_STATUS_PENDING,
    APPROVAL_STATUS_APPROVED,
    APPROVAL_STATUS_DISABLED,
)
from app.modules.auth.permissions import (
    ROLE_APPLICANT,
    SYSTEM_PERMISSIONS,
    PERMISSION_PRESETS,
    ensure_system_permissions,
)
from app.modules.auth.selectors import (
    get_user_by_email,
    get_user_by_identifier,
    get_user_by_id,
    get_role_by_name,
    get_active_refresh_token,
)

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash password string using Argon2."""
    return _password_hasher.hash(password)


def verify_password(hashed_password: str, plain_password: str) -> bool:
    """Verify password against Argon2 hash."""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


class AuthService:
    """Business operations and state management for Candidate Enrollment authentication."""

    @staticmethod
    def register_user(
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        username: Optional[str] = None,
        role_name: str = ROLE_APPLICANT,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """Register a new candidate/user and assign role inside an atomic transaction."""
        normalized_email = email.strip().lower()

        existing = get_user_by_email(normalized_email)
        if existing:
            raise ConflictError(f"Email '{normalized_email}' is already registered.")

        if username:
            existing_un = get_user_by_identifier(username)
            if existing_un:
                raise ConflictError(f"Username '{username}' is already taken.")

        role = get_role_by_name(role_name)
        if not role:
            role = Role(name=role_name, description=f"Default {role_name} role")
            db.session.add(role)

        password_hash = hash_password(password)

        with atomic():
            user = User(
                email=normalized_email,
                username=username.strip().lower() if username else None,
                password_hash=password_hash,
                first_name=first_name.strip(),
                last_name=last_name.strip(),
                is_active=True,
                is_verified=False,
                approval_status=APPROVAL_STATUS_APPROVED if role_name == "admin" else APPROVAL_STATUS_PENDING,
            )
            user.roles.append(role)
            db.session.add(user)
            db.session.flush()

            # Audit record
            audit = AuditLog(
                user_id=user.id,
                action="CANDIDATE_REGISTERED",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={"email": normalized_email, "role": role_name},
            )
            db.session.add(audit)

        return user

    @staticmethod
    def authenticate_user(
        identifier: Optional[str] = None,
        email: Optional[str] = None,
        password: str = "",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Validate credentials by username or email and generate JWT access + refresh tokens.
        Returns (user, access_token, refresh_token).
        """
        lookup_val = identifier or email
        if not lookup_val:
            raise AuthenticationError("Username or email is required.")

        user = get_user_by_identifier(lookup_val)
        if not user or not verify_password(user.password_hash, password):
            raise AuthenticationError("Invalid username/email or password.")

        if not user.is_active or user.deleted_at is not None or user.approval_status == APPROVAL_STATUS_DISABLED:
            raise AuthenticationError("Account has been disabled. Please contact an administrator.")

        if user.approval_status == APPROVAL_STATUS_PENDING:
            raise AuthenticationError("Account is pending approval by an administrator before you can sign in.")

        # Create JWT access and refresh tokens
        identity = str(user.id)
        access_token = create_access_token(identity=identity)
        refresh_token = create_refresh_token(identity=identity)

        # Decode refresh token to extract JTI and expiry
        decoded_refresh = decode_token(refresh_token)
        jti = decoded_refresh["jti"]
        exp_timestamp = decoded_refresh["exp"]
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)

        with atomic():
            # Store refresh token record for tracking & revocation
            token_record = RefreshToken(
                user_id=user.id,
                token_jti=jti,
                user_agent=user_agent,
                ip_address=ip_address,
                expires_at=expires_at,
            )
            db.session.add(token_record)

            # Audit log
            audit = AuditLog(
                user_id=user.id,
                action="USER_LOGIN_SUCCESS",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.session.add(audit)

        return user, access_token, refresh_token

    @staticmethod
    def rotate_refresh_token(
        encoded_refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """Rotate refresh token: revoke current token and generate a new token pair."""
        try:
            decoded = decode_token(encoded_refresh_token)
        except Exception:
            raise AuthenticationError("Invalid refresh token.")

        if decoded.get("type") != "refresh":
            raise AuthenticationError("Token provided is not a refresh token.")

        jti = decoded.get("jti")
        token_record = get_active_refresh_token(jti)
        if not token_record:
            raise AuthenticationError("Refresh token has been revoked or expired.")

        user = get_user_by_id(token_record.user_id)
        if not user or not user.is_active:
            raise AuthenticationError("User is no longer active.")

        # Revoke old refresh token
        now = datetime.now(timezone.utc)
        token_record.revoked_at = now

        # Issue new token pair
        identity = str(user.id)
        new_access_token = create_access_token(identity=identity)
        new_refresh_token = create_refresh_token(identity=identity)

        new_decoded = decode_token(new_refresh_token)
        new_jti = new_decoded["jti"]
        new_expires_at = datetime.fromtimestamp(new_decoded["exp"], tz=timezone.utc)

        with atomic():
            new_record = RefreshToken(
                user_id=user.id,
                token_jti=new_jti,
                user_agent=user_agent,
                ip_address=ip_address,
                expires_at=new_expires_at,
            )
            db.session.add(new_record)

        return user, new_access_token, new_refresh_token

    @staticmethod
    def revoke_token(encoded_token: str) -> None:
        """Revoke a refresh token by JTI upon logout."""
        try:
            decoded = decode_token(encoded_token)
            jti = decoded.get("jti")
            if jti:
                record = get_active_refresh_token(jti)
                if record:
                    with atomic():
                        record.revoked_at = datetime.now(timezone.utc)
        except Exception:
            pass

    @staticmethod
    def change_password(
        user: User,
        current_password: str,
        new_password: str,
        confirm_password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """Change user password after verifying current credentials."""
        if new_password != confirm_password:
            raise ValidationError("New password and confirmation do not match.")

        if not verify_password(user.password_hash, current_password):
            raise ValidationError("Current password does not match our records.")

        if len(new_password) < 6:
            raise ValidationError("New password must be at least 6 characters.")

        with atomic():
            user.password_hash = hash_password(new_password)
            user.updated_at = datetime.now(timezone.utc)

            # Record audit event
            audit = AuditLog(
                user_id=user.id,
                action="PASSWORD_CHANGED",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.session.add(audit)

    @staticmethod
    def list_users() -> list[User]:
        """List all users for admin approval management."""
        stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
        return list(db.session.execute(stmt).scalars().all())

    @staticmethod
    def approve_user(
        user_id: uuid.UUID,
        admin_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """Approve portal access for a user."""
        user = db.session.get(User, user_id)
        if not user or user.deleted_at is not None:
            raise NotFoundError("User not found.")

        with atomic():
            user.approval_status = APPROVAL_STATUS_APPROVED
            user.is_active = True
            user.updated_at = datetime.now(timezone.utc)

            audit = AuditLog(
                user_id=admin_user.id,
                action="USER_ACCESS_APPROVED",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={"target_email": user.email, "status": APPROVAL_STATUS_APPROVED},
            )
            db.session.add(audit)

        return user

    @staticmethod
    def disable_user(
        user_id: uuid.UUID,
        admin_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """Disable portal access for a user."""
        if str(user_id) == str(admin_user.id):
            raise ValidationError("You cannot disable your own admin account.")

        user = db.session.get(User, user_id)
        if not user or user.deleted_at is not None:
            raise NotFoundError("User not found.")

        # Safeguard: Do not disable the last active administrator
        if "users:manage" in user.permission_codes or "admin" in user.role_names:
            all_users = AuthService.list_users()
            active_admins = [
                u for u in all_users
                if u.is_active
                and u.approval_status == APPROVAL_STATUS_APPROVED
                and ("users:manage" in u.permission_codes or "admin" in u.role_names)
                and str(u.id) != str(user.id)
            ]
            if len(active_admins) == 0:
                raise ValidationError("Cannot disable the last active administrator account.")

        with atomic():
            user.approval_status = APPROVAL_STATUS_DISABLED
            user.is_active = False
            user.updated_at = datetime.now(timezone.utc)

            # Revoke refresh tokens
            now = datetime.now(timezone.utc)
            db.session.execute(
                RefreshToken.__table__.update()
                .where(RefreshToken.user_id == user.id)
                .where(RefreshToken.revoked_at.is_(None))
                .values(revoked_at=now)
            )

            audit = AuditLog(
                user_id=admin_user.id,
                action="USER_ACCESS_DISABLED",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={"target_email": user.email, "status": APPROVAL_STATUS_DISABLED},
            )
            db.session.add(audit)

        return user

    @staticmethod
    def admin_create_user(
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        username: Optional[str] = None,
        role_name: Optional[str] = "staff",
        permissions: Optional[list[str]] = None,
        is_active: bool = True,
        approval_status: str = APPROVAL_STATUS_APPROVED,
        admin_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """Create a user directly with configured permissions by an authorized administrator."""
        normalized_email = email.strip().lower()
        existing = get_user_by_email(normalized_email)
        if existing:
            raise ConflictError(f"Email '{normalized_email}' is already registered.")

        if username:
            normalized_username = username.strip().lower()
            existing_un = get_user_by_identifier(normalized_username)
            if existing_un:
                raise ConflictError(f"Username '{normalized_username}' is already taken.")
        else:
            normalized_username = None

        if len(password) < 6:
            raise ValidationError("Password must be at least 6 characters.")

        assigned_role_name = (role_name or "staff").strip().lower()
        role = get_role_by_name(assigned_role_name)
        if not role:
            role = Role(name=assigned_role_name, description=f"Portal {assigned_role_name} role")
            db.session.add(role)

        password_hash = hash_password(password)

        # Make sure system permissions exist in DB
        ensure_system_permissions()

        with atomic():
            user = User(
                email=normalized_email,
                username=normalized_username,
                password_hash=password_hash,
                first_name=first_name.strip(),
                last_name=last_name.strip(),
                is_active=is_active,
                is_verified=True,
                approval_status=approval_status,
            )
            user.roles.append(role)
            db.session.add(user)
            db.session.flush()

            # Assign dynamic permissions if provided
            assigned_codes = []
            if permissions is not None:
                perm_objs = list(
                    db.session.execute(
                        select(Permission).where(Permission.code.in_(permissions))
                    ).scalars().all()
                )
                user.permissions = perm_objs
                assigned_codes = [p.code for p in perm_objs]

            if admin_user:
                audit = AuditLog(
                    user_id=admin_user.id,
                    action="USER_CREATED_BY_ADMIN",
                    resource="User",
                    resource_id=str(user.id),
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={
                        "email": normalized_email,
                        "username": normalized_username,
                        "role": assigned_role_name,
                        "permissions": assigned_codes,
                        "approval_status": approval_status,
                    },
                )
                db.session.add(audit)

        return user

    @staticmethod
    def admin_update_user(
        user_id: uuid.UUID,
        data: dict[str, Any],
        admin_user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """Update user details, password, access status, and dynamic permissions."""
        user = db.session.get(User, user_id)
        if not user or user.deleted_at is not None:
            raise NotFoundError("User not found.")

        is_self = str(user.id) == str(admin_user.id)

        # Self-modification safeguards
        if is_self:
            if "is_active" in data and not data["is_active"]:
                raise ValidationError("You cannot deactivate your own administrator account.")
            if "approval_status" in data and data["approval_status"] == APPROVAL_STATUS_DISABLED:
                raise ValidationError("You cannot disable your own administrator account.")

        # Email update check
        if "email" in data and data["email"]:
            new_email = data["email"].strip().lower()
            if new_email != user.email:
                existing_email = get_user_by_email(new_email)
                if existing_email:
                    raise ConflictError(f"Email '{new_email}' is already registered.")
                user.email = new_email

        # Username update check
        if "username" in data:
            new_un = data["username"].strip().lower() if data["username"] else None
            if new_un != user.username:
                if new_un:
                    existing_un = get_user_by_identifier(new_un)
                    if existing_un:
                        raise ConflictError(f"Username '{new_un}' is already taken.")
                user.username = new_un

        if "first_name" in data and data["first_name"]:
            user.first_name = data["first_name"].strip()

        if "last_name" in data and data["last_name"]:
            user.last_name = data["last_name"].strip()

        # Password update
        if "password" in data and data["password"]:
            if len(data["password"]) < 6:
                raise ValidationError("New password must be at least 6 characters.")
            user.password_hash = hash_password(data["password"])

        # Status update
        if "is_active" in data:
            user.is_active = bool(data["is_active"])

        if "approval_status" in data and data["approval_status"]:
            user.approval_status = data["approval_status"]
            if user.approval_status == APPROVAL_STATUS_DISABLED:
                user.is_active = False

        # Role update
        if "role" in data and data["role"]:
            role_name = data["role"].strip().lower()
            role = get_role_by_name(role_name)
            if not role:
                role = Role(name=role_name, description=f"Portal {role_name} role")
                db.session.add(role)
            user.roles = [role]

        # Permissions assignment
        updated_permissions = None
        if "permissions" in data and data["permissions"] is not None:
            desired_codes = set(data["permissions"])

            # Safeguard: Check if removing users:manage from last active administrator
            if is_self and "users:manage" not in desired_codes:
                all_users = AuthService.list_users()
                other_admins = [
                    u for u in all_users
                    if u.is_active
                    and u.approval_status == APPROVAL_STATUS_APPROVED
                    and ("users:manage" in u.permission_codes or "admin" in u.role_names)
                    and str(u.id) != str(user.id)
                ]
                if len(other_admins) == 0:
                    raise ValidationError("Cannot remove 'users:manage' from the last remaining administrator.")

            ensure_system_permissions()
            perm_objs = list(
                db.session.execute(
                    select(Permission).where(Permission.code.in_(list(desired_codes)))
                ).scalars().all()
            )
            user.permissions = perm_objs
            updated_permissions = [p.code for p in perm_objs]

        user.updated_at = datetime.now(timezone.utc)

        # If deactivated/disabled, revoke all active sessions/refresh tokens
        if not user.is_active or user.approval_status == APPROVAL_STATUS_DISABLED:
            now = datetime.now(timezone.utc)
            db.session.execute(
                RefreshToken.__table__.update()
                .where(RefreshToken.user_id == user.id)
                .where(RefreshToken.revoked_at.is_(None))
                .values(revoked_at=now)
            )

        with atomic():
            audit = AuditLog(
                user_id=admin_user.id,
                action="USER_UPDATED_BY_ADMIN",
                resource="User",
                resource_id=str(user.id),
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "target_email": user.email,
                    "target_user_id": str(user.id),
                    "is_active": user.is_active,
                    "approval_status": user.approval_status,
                    "permissions": updated_permissions,
                },
            )
            db.session.add(audit)

        return user

    @staticmethod
    def get_permissions_metadata() -> dict[str, Any]:
        """Return available system permissions catalog and reusable presets."""
        ensure_system_permissions()
        return {
            "permissions": SYSTEM_PERMISSIONS,
            "presets": PERMISSION_PRESETS,
        }
