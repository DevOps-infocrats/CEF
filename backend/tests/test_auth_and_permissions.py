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
        username=email.split("@")[0].lower().strip(),
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


def login(client, identifier: str, password: str):
    """Log in with username or email."""
    resp = client.post("/api/v1/auth/login", json={"email": identifier, "password": password})
    return resp


def upload_dummy_file(client, category: str):
    data = {
        "file": (io.BytesIO(b"%PDF-1.4 dummy document stream"), f"{category}.pdf"),
        "category": category,
    }
    resp = client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        content_type="multipart/form-data",
    )
    return resp


def test_user_management_lifecycle_and_end_to_end_permissions(client, app, sample_valid_payload):
    """
    Complete End-to-End Workflow:
    1. Admin creates user with username, password, and specific permissions (data-entry subset).
    2. User logs in with exact username.
    3. User logs in with mixed-case username (case-insensitivity check).
    4. User logs in with email.
    5. User attempts invalid password -> rejected.
    6. User accesses permitted endpoints -> allowed.
    7. User attempts restricted operations (verify, approve, reject, user management) -> 403 Forbidden.
    8. Admin updates permissions -> user can perform newly authorized actions immediately.
    9. User cannot escalate privileges.
    """
    with app.app_context():
        admin = create_user("super_admin@cef.com", "AdminPass@123", ["users:manage", "portal:access"], role="admin")

    # 1. Admin logs in
    admin_login = login(client, "super_admin@cef.com", "AdminPass@123")
    assert admin_login.status_code == 200
    admin_token = admin_login.json["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Admin creates a new user via API
    create_payload = {
        "first_name": "Suresh",
        "last_name": "Kumar",
        "email": "suresh.kumar@example.com",
        "username": "suresh_entry",
        "password": "Password@1234",
        "role": "staff",
        "permissions": ["portal:access", "candidates:read", "candidates:create", "candidates:submit"],
        "is_active": True,
        "approval_status": "APPROVED",
    }
    create_res = client.post("/api/v1/auth/users", headers=admin_headers, json=create_payload)
    assert create_res.status_code == 201
    created_user_id = create_res.json["data"]["id"]
    assert create_res.json["data"]["username"] == "suresh_entry"
    assert "candidates:create" in create_res.json["data"]["permissions"]
    assert "candidates:approve" not in create_res.json["data"]["permissions"]

    # 3. New user logs in using assigned username
    login_un = login(client, "suresh_entry", "Password@1234")
    assert login_un.status_code == 200, f"Login by username failed: {login_un.json}"
    assert login_un.json["data"]["user"]["email"] == "suresh.kumar@example.com"
    user_token = login_un.json["data"]["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 4. New user logs in using mixed-case username
    login_un_case = login(client, "Suresh_Entry", "Password@1234")
    assert login_un_case.status_code == 200, f"Login by mixed-case username failed: {login_un_case.json}"

    # 5. New user logs in using email
    login_email = login(client, "suresh.kumar@example.com", "Password@1234")
    assert login_email.status_code == 200, f"Login by email failed: {login_email.json}"

    # 6. Incorrect password fails
    bad_login = login(client, "suresh_entry", "WrongPassword!")
    assert bad_login.status_code == 401

    # 7. User can perform authorized actions: submit candidate application
    # Upload documents first
    up1 = client.post("/api/v1/applications/documents/upload", headers=user_headers, data={"file": (io.BytesIO(b"dummy"), "aadhaar.pdf"), "category": "aadhaar_card"}, content_type="multipart/form-data")
    assert up1.status_code == 201
    up2 = client.post("/api/v1/applications/documents/upload", headers=user_headers, data={"file": (io.BytesIO(b"dummy"), "pan.pdf"), "category": "pan_card"}, content_type="multipart/form-data")
    assert up2.status_code == 201
    up3 = client.post("/api/v1/applications/documents/upload", headers=user_headers, data={"file": (io.BytesIO(b"dummy"), "bank.pdf"), "category": "bank_passbook"}, content_type="multipart/form-data")
    assert up3.status_code == 201

    app_res = client.post("/api/v1/applications", headers=user_headers, json=sample_valid_payload)
    assert app_res.status_code == 201
    app_id = app_res.json["data"]["id"]

    # 8. User attempts restricted operations -> MUST be denied 403 Forbidden
    # 8a. User management endpoints
    assert client.get("/api/v1/auth/users", headers=user_headers).status_code == 403
    assert client.post("/api/v1/auth/users", headers=user_headers, json={"email": "hack@cef.com"}).status_code == 403
    assert client.patch(f"/api/v1/auth/users/{created_user_id}", headers=user_headers, json={"permissions": ["users:manage"]}).status_code == 403

    # 8b. Verification actions
    ver_res = client.post(f"/api/v1/applications/{app_id}/verification/personal_info/done", headers=user_headers, json={})
    assert ver_res.status_code == 403

    # 8c. Candidate Approval
    appr_res = client.post(f"/api/v1/applications/{app_id}/approve", headers=user_headers)
    assert appr_res.status_code == 403

    # 8d. Candidate Rejection
    rej_res = client.post(f"/api/v1/applications/{app_id}/reject", headers=user_headers, json={"reason": "Test"})
    assert rej_res.status_code == 403

    # 9. Admin modifies user's permissions to grant verification and approval rights
    update_res = client.patch(
        f"/api/v1/auth/users/{created_user_id}",
        headers=admin_headers,
        json={
            "permissions": [
                "portal:access",
                "candidates:read",
                "documents:verify",
                "candidates:approve",
            ],
        },
    )
    assert update_res.status_code == 200
    assert "candidates:approve" in update_res.json["data"]["permissions"]

    # 10. The user's existing session immediately has the updated permissions!
    # Initialize checklist for application
    with app.app_context():
        app_obj = db.session.get(CandidateApplication, uuid.UUID(app_id))
        CandidateService.initialize_verification_checklist(app_obj)

    # Now Suresh CAN mark verification items done
    mark_ok = client.post(
        f"/api/v1/applications/{app_id}/verification/personal_info/done",
        headers=user_headers,
        json={"remarks": "Verified by Suresh"},
    )
    assert mark_ok.status_code == 200

    # Complete all other verification items so approval can succeed
    with app.app_context():
        items = CandidateVerificationItem.query.filter_by(application_id=uuid.UUID(app_id)).all()
        for it in items:
            it.status = VERIFICATION_STATUS_DONE
        db.session.commit()

    # Now Suresh CAN approve candidate
    appr_ok = client.post(f"/api/v1/applications/{app_id}/approve", headers=user_headers)
    assert appr_ok.status_code == 200
    assert appr_ok.json["data"]["status"] == APPLICATION_STATUS_APPROVED

    # Suresh still cannot reject or manage users
    assert client.post(f"/api/v1/applications/{app_id}/reject", headers=user_headers, json={"reason": "No"}).status_code == 403
    assert client.get("/api/v1/auth/users", headers=user_headers).status_code == 403


def test_user_creation_with_empty_or_whitespace_username(client, app):
    """Admin creating user with blank or whitespace username succeeds cleanly without schema error."""
    with app.app_context():
        admin = create_user("admin_un@example.com", "AdminPass@123", ["users:manage"], role="admin")

    login_res = login(client, "admin_un@example.com", "AdminPass@123")
    headers = {"Authorization": f"Bearer {login_res.json['data']['access_token']}"}

    # Empty string username (from frontend default empty input)
    create_payload = {
        "first_name": "Pooja",
        "last_name": "Joshi",
        "email": "pooja.joshi@example.com",
        "username": "",
        "password": "Password@1234",
        "role": "staff",
        "permissions": ["portal:access", "candidates:read"],
        "is_active": True,
    }
    resp = client.post("/api/v1/auth/users", headers=headers, json=create_payload)
    assert resp.status_code == 201
    assert resp.json["data"]["email"] == "pooja.joshi@example.com"

    # User can log in with email
    pooja_login = login(client, "pooja.joshi@example.com", "Password@1234")
    assert pooja_login.status_code == 200
