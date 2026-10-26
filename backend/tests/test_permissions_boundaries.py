import io
import uuid
import pytest
from app.extensions import db
from app.modules.auth.models import User, Role, Permission
from app.modules.auth.services import hash_password, AuthService
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateDocument,
    CandidateVerificationItem,
    VERIFICATION_STATUS_PENDING,
    VERIFICATION_STATUS_DONE,
    APPLICATION_STATUS_APPROVED,
    APPLICATION_STATUS_REJECTED,
)
from app.modules.candidates.services import CandidateService


def create_user(email: str, password: str, permissions: list[str] = None, role: str = "staff", is_active: bool = True):
    """Helper creating a test user with exact dynamic permissions assigned in DB."""
    perm_objs = []
    if permissions:
        perm_objs = db.session.query(Permission).filter(Permission.code.in_(permissions)).all()

    user = User(
        email=email.lower().strip(),
        username=email.split("@")[0],
        password_hash=hash_password(password),
        first_name="Test",
        last_name="User",
        is_active=is_active,
        is_verified=True,
        approval_status="APPROVED" if is_active else "DISABLED",
    )
    r = Role.query.filter_by(name=role).first()
    if not r:
        r = Role(name=role)
        db.session.add(r)
    user.roles.append(r)
    user.permissions = perm_objs
    db.session.add(user)
    db.session.commit()
    return user


def login(client, email: str, password: str):
    """Log in and set cookies on test client."""
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.json}"
    return resp


def upload_dummy_file(client, category: str):
    """Upload a mock document."""
    data = {
        "file": (io.BytesIO(b"%PDF-1.4 dummy document stream"), f"{category}.pdf"),
        "category": category,
    }
    resp = client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201, f"Upload failed for {category}: {resp.json}"
    return resp


def test_admin_can_create_user_and_new_user_can_login(client, app):
    """1. An authorized administrator can create a portal user with dynamic permissions, and the user can log in."""
    with app.app_context():
        admin = create_user("admin_test@example.com", "Admin@123", ["users:manage", "portal:access"], role="admin")

    login(client, "admin_test@example.com", "Admin@123")

    create_payload = {
        "first_name": "Vikram",
        "last_name": "Patel",
        "email": "vikram.data@example.com",
        "username": "vikram_data",
        "password": "Password@123",
        "role": "staff",
        "permissions": ["portal:access", "candidates:read", "candidates:create", "candidates:submit"],
        "is_active": True,
    }

    create_resp = client.post("/api/v1/auth/users", json=create_payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json["data"]
    assert created_data["email"] == "vikram.data@example.com"
    assert "candidates:create" in created_data["permissions"]

    # Client logs out and new user logs in
    client.post("/api/v1/auth/logout")
    login_resp = login(client, "vikram.data@example.com", "Password@123")
    user_info = login_resp.json["data"]["user"]
    assert user_info["email"] == "vikram.data@example.com"
    assert "candidates:create" in user_info["permissions"]


def test_data_entry_user_boundaries(client, app, sample_valid_payload):
    """4 & 5. A data-entry user can submit applications, but CANNOT approve, reject, or verify."""
    with app.app_context():
        # User with ONLY data entry permissions
        de_user = create_user(
            "dataentry@example.com",
            "DataEntry@123",
            permissions=["portal:access", "candidates:read", "candidates:create", "candidates:submit", "candidates:write"],
            role="staff",
        )

    login(client, "dataentry@example.com", "DataEntry@123")

    # Staging mandatory documents
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    # Data entry user can submit application
    sub_resp = client.post("/api/v1/applications", json=sample_valid_payload)
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    # Data entry user attempts to mark verification item done -> 403 Forbidden
    ver_resp = client.post(f"/api/v1/applications/{app_id}/verification/personal_info/done", json={})
    assert ver_resp.status_code == 403
    assert "Missing required permission: 'documents:verify'" in ver_resp.json["message"]

    # Data entry user attempts to bulk verify -> 403 Forbidden
    bulk_resp = client.post(f"/api/v1/applications/{app_id}/verification/bulk-done", json={})
    assert bulk_resp.status_code == 403
    assert "Missing required permission: 'documents:bulk_verify'" in bulk_resp.json["message"]

    # Data entry user attempts to approve candidate -> 403 Forbidden
    appr_resp = client.post(f"/api/v1/applications/{app_id}/approve")
    assert appr_resp.status_code == 403
    assert "Missing required permission: 'candidates:approve'" in appr_resp.json["message"]

    # Data entry user attempts to reject candidate -> 403 Forbidden
    rej_resp = client.post(f"/api/v1/applications/{app_id}/reject", json={"reason": "Testing"})
    assert rej_resp.status_code == 403
    assert "Missing required permission: 'candidates:reject'" in rej_resp.json["message"]

    # Data entry user attempts to access user management -> 403 Forbidden
    users_resp = client.get("/api/v1/auth/users")
    assert users_resp.status_code == 403


def test_independent_approval_and_rejection_permissions(client, app, sample_valid_payload):
    """7. Approval and Rejection permissions are enforced independently."""
    with app.app_context():
        # Creator submits an application
        creator = create_user("creator@example.com", "Pass@123", ["portal:access", "candidates:create", "candidates:write"])

    login(client, "creator@example.com", "Pass@123")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")
    sub_resp = client.post("/api/v1/applications", json=sample_valid_payload)
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    with app.app_context():
        app_obj = db.session.get(CandidateApplication, uuid.UUID(app_id))
        CandidateService.initialize_verification_checklist(app_obj)
        items = CandidateVerificationItem.query.filter_by(application_id=app_obj.id).all()
        for it in items:
            it.status = VERIFICATION_STATUS_DONE
        db.session.commit()

        # User A: HAS candidates:approve, but LACKS candidates:reject
        user_approver_only = create_user(
            "approver_only@example.com",
            "Approver@123",
            permissions=["portal:access", "candidates:read", "documents:verify", "candidates:approve"],
        )

        # User B: HAS candidates:reject, but LACKS candidates:approve
        user_rejecter_only = create_user(
            "rejecter_only@example.com",
            "Rejecter@123",
            permissions=["portal:access", "candidates:read", "documents:verify", "candidates:reject"],
        )

    # 1. Test Approver-Only user
    client.post("/api/v1/auth/logout")
    login(client, "approver_only@example.com", "Approver@123")

    # Approver attempts to reject -> MUST BE FORBIDDEN (403)
    rej_fail = client.post(f"/api/v1/applications/{app_id}/reject", json={"reason": "Unauthorized rejection attempt"})
    assert rej_fail.status_code == 403
    assert "Missing required permission: 'candidates:reject'" in rej_fail.json["message"]

    # Approver attempts to approve -> ALLOWED (200 OK)
    appr_ok = client.post(f"/api/v1/applications/{app_id}/approve")
    assert appr_ok.status_code == 200
    assert appr_ok.json["data"]["status"] == APPLICATION_STATUS_APPROVED

    # Reset application status to PENDING for testing Rejecter
    with app.app_context():
        app_obj = db.session.get(CandidateApplication, uuid.UUID(app_id))
        app_obj.status = "IN_PROGRESS"
        db.session.commit()

    # 2. Test Rejecter-Only user
    client.post("/api/v1/auth/logout")
    login(client, "rejecter_only@example.com", "Rejecter@123")

    # Rejecter attempts to approve -> MUST BE FORBIDDEN (403)
    appr_fail = client.post(f"/api/v1/applications/{app_id}/approve")
    assert appr_fail.status_code == 403
    assert "Missing required permission: 'candidates:approve'" in appr_fail.json["message"]

    # Rejecter attempts to reject -> ALLOWED (200 OK)
    rej_ok = client.post(
        f"/api/v1/applications/{app_id}/reject",
        json={"reason": "Authorized rejection due to document inconsistency"},
    )
    assert rej_ok.status_code == 200
    assert rej_ok.json["data"]["status"] == APPLICATION_STATUS_REJECTED


def test_inactive_user_cannot_login_or_perform_actions(client, app):
    """9. Inactive or disabled users cannot log in or perform actions."""
    with app.app_context():
        user = create_user("inactive@example.com", "Pass@1234", ["portal:access", "candidates:read"], is_active=False)

    # Attempt to log in with disabled account
    login_resp = client.post("/api/v1/auth/login", json={"email": "inactive@example.com", "password": "Pass@1234"})
    assert login_resp.status_code == 401
    assert "disabled" in login_resp.json["message"].lower()


def test_last_admin_safeguard(client, app):
    """8. Administrator cannot disable self or remove users:manage from the only active administrator."""
    with app.app_context():
        sole_admin = create_user("sole_admin@example.com", "Admin@123", ["users:manage", "portal:access"], role="admin")
        admin_id = str(sole_admin.id)

    login(client, "sole_admin@example.com", "Admin@123")

    # Attempt to disable self -> 400 Validation Error
    disable_resp = client.post(f"/api/v1/auth/users/{admin_id}/disable")
    assert disable_resp.status_code == 400
    assert "cannot disable your own" in disable_resp.json["message"].lower()

    # Attempt to revoke users:manage from self when sole admin -> 400 Validation Error
    patch_resp = client.patch(
        f"/api/v1/auth/users/{admin_id}",
        json={"permissions": ["portal:access", "candidates:read"]},
    )
    assert patch_resp.status_code == 400
    assert "last remaining administrator" in patch_resp.json["message"].lower()


def test_unauthorized_user_cannot_modify_users_or_elevate_privileges(client, app):
    """8. Non-admin users cannot call user management endpoints."""
    with app.app_context():
        non_admin = create_user("staff_member@example.com", "Staff@123", ["portal:access", "candidates:read"])
        target_user = create_user("target@example.com", "Target@123", ["portal:access"])
        target_id = str(target_user.id)

    login(client, "staff_member@example.com", "Staff@123")

    # Try to list users
    assert client.get("/api/v1/auth/users").status_code == 403

    # Try to create user
    assert client.post("/api/v1/auth/users", json={"email": "hacked@example.com", "password": "Password123", "first_name": "A", "last_name": "B"}).status_code == 403

    # Try to modify another user's permissions
    assert client.patch(f"/api/v1/auth/users/{target_id}", json={"permissions": ["users:manage"]}).status_code == 403
