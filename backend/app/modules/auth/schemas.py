from marshmallow import Schema, fields, validate, pre_load
from app.common.permissions.authorization import AuthorizationEvaluator


class RegisterRequestSchema(Schema):
    """Validation schema for candidate / user registration."""

    email = fields.Email(required=True, validate=validate.Length(max=255))
    username = fields.String(required=False, validate=validate.Length(min=3, max=100))
    password = fields.String(required=True, validate=validate.Length(min=6, max=128))
    first_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    last_name = fields.String(required=True, validate=validate.Length(min=1, max=100))


class LoginRequestSchema(Schema):
    """Validation schema for user authentication by email or username."""

    email = fields.String(required=False, validate=validate.Length(min=1))
    username = fields.String(required=False, validate=validate.Length(min=1))
    identifier = fields.String(required=False, validate=validate.Length(min=1))
    password = fields.String(required=True, validate=validate.Length(min=1))

    @pre_load
    def process_identifier(self, data, **kwargs):
        if not data:
            return data
        # Support email, username, or identifier field in request
        lookup = data.get("email") or data.get("username") or data.get("identifier")
        if lookup and isinstance(lookup, str):
            data["email"] = lookup.strip()
        return data


class ChangePasswordSchema(Schema):
    """Validation schema for user password update."""

    current_password = fields.String(required=True, validate=validate.Length(min=1))
    new_password = fields.String(required=True, validate=validate.Length(min=6, max=128))
    confirm_password = fields.String(required=True, validate=validate.Length(min=1))


class CreateUserSchema(Schema):
    """Validation schema for admin creating a new user directly."""

    email = fields.Email(required=True, validate=validate.Length(max=255))
    username = fields.String(required=False, allow_none=True, validate=validate.Length(min=3, max=100))
    password = fields.String(required=True, validate=validate.Length(min=6, max=128))
    first_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    last_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    role = fields.String(required=False, allow_none=True)
    permissions = fields.List(fields.String(), required=False, allow_none=True)
    is_active = fields.Boolean(required=False, load_default=True)
    approval_status = fields.String(required=False, load_default="APPROVED")

    @pre_load
    def sanitize_inputs(self, data, **kwargs):
        if not data:
            return data
        if "email" in data and isinstance(data["email"], str):
            data["email"] = data["email"].strip().lower()
        if "username" in data:
            if data["username"] is not None and isinstance(data["username"], str):
                un = data["username"].strip()
                data["username"] = un if len(un) > 0 else None
            else:
                data["username"] = None
        if "first_name" in data and isinstance(data["first_name"], str):
            data["first_name"] = data["first_name"].strip()
        if "last_name" in data and isinstance(data["last_name"], str):
            data["last_name"] = data["last_name"].strip()
        if not data.get("approval_status"):
            data["approval_status"] = "APPROVED"
        return data


class UpdateUserSchema(Schema):
    """Validation schema for admin updating an existing user and permissions."""

    email = fields.Email(required=False, validate=validate.Length(max=255))
    username = fields.String(required=False, allow_none=True, validate=validate.Length(min=3, max=100))
    password = fields.String(required=False, allow_none=True, validate=validate.Length(min=6, max=128))
    first_name = fields.String(required=False, validate=validate.Length(min=1, max=100))
    last_name = fields.String(required=False, validate=validate.Length(min=1, max=100))
    role = fields.String(required=False, allow_none=True)
    permissions = fields.List(fields.String(), required=False, allow_none=True)
    is_active = fields.Boolean(required=False)
    approval_status = fields.String(required=False)

    @pre_load
    def sanitize_inputs(self, data, **kwargs):
        if not data:
            return data
        if "email" in data and isinstance(data["email"], str):
            data["email"] = data["email"].strip().lower()
        if "username" in data:
            if data["username"] is not None and isinstance(data["username"], str):
                un = data["username"].strip()
                data["username"] = un if len(un) > 0 else None
            else:
                data["username"] = None
        if "first_name" in data and isinstance(data["first_name"], str):
            data["first_name"] = data["first_name"].strip()
        if "last_name" in data and isinstance(data["last_name"], str):
            data["last_name"] = data["last_name"].strip()
        return data


class RoleSchema(Schema):
    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True)


class PermissionDefinitionSchema(Schema):
    code = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    category = fields.String(dump_only=True)
    description = fields.String(dump_only=True)


class UserResponseSchema(Schema):
    """Serialization schema for user profile and authorization scopes."""

    id = fields.UUID(dump_only=True)
    username = fields.String(dump_only=True)
    email = fields.String(dump_only=True)
    first_name = fields.String(dump_only=True)
    last_name = fields.String(dump_only=True)
    full_name = fields.String(dump_only=True)
    is_active = fields.Boolean(dump_only=True)
    is_verified = fields.Boolean(dump_only=True)
    approval_status = fields.String(dump_only=True)
    roles = fields.Method("get_roles", dump_only=True)
    permissions = fields.Method("get_permissions", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    def get_roles(self, obj) -> list[str]:
        return obj.role_names

    def get_permissions(self, obj) -> list[str]:
        if hasattr(obj, "permission_codes"):
            return obj.permission_codes
        scopes = AuthorizationEvaluator.get_permissions_for_roles(obj.role_names)
        return sorted(list(scopes))


class TokenResponseSchema(Schema):
    """Serialization schema for successful authentication output."""

    user = fields.Nested(UserResponseSchema, dump_only=True)
    token_type = fields.Constant("Bearer", dump_only=True)
    access_token = fields.String(dump_only=True)
    expires_in = fields.Integer(dump_only=True)
