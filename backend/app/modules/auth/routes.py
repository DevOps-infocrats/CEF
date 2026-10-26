from flask import Blueprint, request, current_app, g
from flask_jwt_extended import (
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from app.extensions import limiter
from app.common.responses import api_response
from app.common.errors.exceptions import AuthenticationError
from app.common.permissions.decorators import require_auth, require_roles, require_permission
from app.modules.auth.schemas import (
    RegisterRequestSchema,
    LoginRequestSchema,
    UserResponseSchema,
    ChangePasswordSchema,
    CreateUserSchema,
    UpdateUserSchema,
)
from app.modules.auth.services import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

_register_schema = RegisterRequestSchema()
_login_schema = LoginRequestSchema()
_user_schema = UserResponseSchema()
_users_list_schema = UserResponseSchema(many=True)
_change_password_schema = ChangePasswordSchema()
_create_user_schema = CreateUserSchema()
_update_user_schema = UpdateUserSchema()


def _get_client_metadata() -> tuple[str, str]:
    """Helper extracting IP address and User-Agent from incoming request."""
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
    if "," in ip:
        ip = ip.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "unknown")[:250]
    return ip, user_agent


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    """Register a new clean energy applicant."""
    payload = request.get_json(silent=True) or {}
    validated_data = _register_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    user = AuthService.register_user(
        email=validated_data["email"],
        username=validated_data.get("username"),
        password=validated_data["password"],
        first_name=validated_data["first_name"],
        last_name=validated_data["last_name"],
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=_user_schema.dump(user),
        message="Registration successful. You may now log in.",
        status_code=201,
    )


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    """Authenticate user credentials and issue secure cookies."""
    payload = request.get_json(silent=True) or {}
    validated_data = _login_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    user, access_token, refresh_token = AuthService.authenticate_user(
        email=validated_data["email"],
        password=validated_data["password"],
        ip_address=ip_address,
        user_agent=user_agent,
    )

    response, status_code = api_response(
        data={
            "user": _user_schema.dump(user),
            "token_type": "Bearer",
            "access_token": access_token,
        },
        message="Authentication successful.",
        status_code=200,
    )

    # Attach HttpOnly cookies to response
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response, status_code


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """Rotate refresh token and issue a fresh access token."""
    refresh_token = (
        request.cookies.get(current_app.config["JWT_REFRESH_COOKIE_NAME"])
        or (request.get_json(silent=True) or {}).get("refresh_token")
    )
    if not refresh_token:
        raise AuthenticationError("Missing refresh token in cookies or payload.")

    ip_address, user_agent = _get_client_metadata()

    user, new_access_token, new_refresh_token = AuthService.rotate_refresh_token(
        encoded_refresh_token=refresh_token,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    response, status_code = api_response(
        data={
            "user": _user_schema.dump(user),
            "access_token": new_access_token,
        },
        message="Token refreshed successfully.",
        status_code=200,
    )

    set_access_cookies(response, new_access_token)
    set_refresh_cookies(response, new_refresh_token)
    return response, status_code


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Revoke session and clear authentication cookies."""
    refresh_token = request.cookies.get(current_app.config["JWT_REFRESH_COOKIE_NAME"])
    if refresh_token:
        AuthService.revoke_token(refresh_token)

    response, status_code = api_response(
        data=None,
        message="Logged out successfully.",
        status_code=200,
    )
    unset_jwt_cookies(response)
    return response, status_code


@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user_profile():
    """Retrieve profile and permissions for currently authenticated user."""
    return api_response(
        data=_user_schema.dump(g.current_user),
        message="Profile retrieved successfully.",
        status_code=200,
    )


@auth_bp.route("/change-password", methods=["POST"])
@require_auth
def change_password():
    """Update password for the currently authenticated user."""
    payload = request.get_json(silent=True) or {}
    validated_data = _change_password_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    AuthService.change_password(
        user=g.current_user,
        current_password=validated_data["current_password"],
        new_password=validated_data["new_password"],
        confirm_password=validated_data["confirm_password"],
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data={"updated": True},
        message="Password updated successfully.",
        status_code=200,
    )


# ---------------------------------------------------------
# Dynamic Permissions & User Management Endpoints
# ---------------------------------------------------------

@auth_bp.route("/permissions", methods=["GET"])
@require_auth
def get_permissions_catalog():
    """Retrieve system permissions catalog and reusable presets."""
    meta = AuthService.get_permissions_metadata()
    return api_response(
        data=meta,
        message="Permissions catalog retrieved successfully.",
        status_code=200,
    )


@auth_bp.route("/users", methods=["GET"])
@require_permission("users:manage")
def list_users():
    """List all portal users with assigned permissions."""
    users = AuthService.list_users()
    return api_response(
        data=_users_list_schema.dump(users),
        message="User list retrieved successfully.",
        status_code=200,
    )


@auth_bp.route("/users", methods=["POST"])
@require_permission("users:manage")
def create_user_by_admin():
    """Create a new portal user with designated permissions (Administrator only)."""
    payload = request.get_json(silent=True) or {}
    validated_data = _create_user_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    user = AuthService.admin_create_user(
        email=validated_data["email"],
        password=validated_data["password"],
        first_name=validated_data["first_name"],
        last_name=validated_data["last_name"],
        username=validated_data.get("username"),
        role_name=validated_data.get("role", "staff"),
        permissions=validated_data.get("permissions"),
        is_active=validated_data.get("is_active", True),
        approval_status=validated_data.get("approval_status", "APPROVED"),
        admin_user=g.current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=_user_schema.dump(user),
        message="User account created and permissions assigned successfully.",
        status_code=201,
    )


@auth_bp.route("/users/<uuid:user_id>", methods=["PATCH"])
@require_permission("users:manage")
def update_user_by_admin(user_id):
    """Update user details, credentials, status, or permissions (Administrator only)."""
    payload = request.get_json(silent=True) or {}
    validated_data = _update_user_schema.load(payload)

    ip_address, user_agent = _get_client_metadata()

    updated_user = AuthService.admin_update_user(
        user_id=user_id,
        data=validated_data,
        admin_user=g.current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return api_response(
        data=_user_schema.dump(updated_user),
        message=f"User account updated successfully for {updated_user.full_name}.",
        status_code=200,
    )


@auth_bp.route("/users/<uuid:user_id>/approve", methods=["POST"])
@require_permission("users:manage")
def approve_user(user_id):
    """Approve a user's portal access (Administrator only)."""
    ip_address, user_agent = _get_client_metadata()
    updated_user = AuthService.approve_user(
        user_id=user_id,
        admin_user=g.current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return api_response(
        data=_user_schema.dump(updated_user),
        message=f"Portal access approved for {updated_user.full_name}.",
        status_code=200,
    )


@auth_bp.route("/users/<uuid:user_id>/disable", methods=["POST"])
@require_permission("users:manage")
def disable_user(user_id):
    """Disable a user's portal access (Administrator only)."""
    ip_address, user_agent = _get_client_metadata()
    updated_user = AuthService.disable_user(
        user_id=user_id,
        admin_user=g.current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return api_response(
        data=_user_schema.dump(updated_user),
        message=f"Portal access disabled for {updated_user.full_name}.",
        status_code=200,
    )
