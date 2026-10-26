import pytest
from app.modules.auth.models import User, Role, APPROVAL_STATUS_PENDING, APPROVAL_STATUS_APPROVED, APPROVAL_STATUS_DISABLED
from app.modules.auth.services import hash_password
from app.extensions import db


def create_test_user(email, password, role_name="candidate", approval_status=APPROVAL_STATUS_APPROVED):
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="Test",
        last_name=role_name.capitalize(),
        is_active=(approval_status == APPROVAL_STATUS_APPROVED),
        approval_status=approval_status,
    )
    role = Role.query.filter_by(name=role_name).first()
    if role:
        user.roles.append(role)
    db.session.add(user)
    db.session.commit()
    return user


def test_health_check(client):
    """Test public health endpoint."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "candidate-enrollment-portal-api"


def test_candidate_registration_success(client):
    """Test successful candidate registration sets approval_status to PENDING_APPROVAL."""
    payload = {
        "email": "candidate@example.org",
        "password": "Password123",
        "first_name": "Rohan",
        "last_name": "Verma",
    }
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    assert body["data"]["email"] == "candidate@example.org"
    assert body["data"]["approval_status"] == APPROVAL_STATUS_PENDING
    assert "candidate" in body["data"]["roles"]


def test_unapproved_user_cannot_login(client):
    """Test that users pending approval cannot sign in."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "pending@example.org",
            "password": "Password123",
            "first_name": "Pending",
            "last_name": "User",
        },
    )

    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "pending@example.org",
            "password": "Password123",
        },
    )
    assert res.status_code == 401
    body = res.get_json()
    assert body["success"] is False
    assert "pending approval" in body["message"].lower()


def test_login_success_after_admin_approval(client, app):
    """Test approved user login returns access token and sets cookies."""
    with app.app_context():
        create_test_user("student@example.org", "Password123", "candidate", APPROVAL_STATUS_APPROVED)

    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "student@example.org",
            "password": "Password123",
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert "access_token" in body["data"]

    # Check cookies
    cookies = res.headers.getlist("Set-Cookie")
    assert any("cef_access_token=" in c for c in cookies)
    assert any("cef_refresh_token=" in c for c in cookies)


def test_login_with_username_support(client, app):
    """Test user login with username identifier."""
    with app.app_context():
        user = create_test_user("user.test@example.org", "Password123", "candidate", APPROVAL_STATUS_APPROVED)
        user.username = "candidate01"
        db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "candidate01",
            "password": "Password123",
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True


def test_login_invalid_password(client, app):
    """Test login with wrong password fails."""
    with app.app_context():
        create_test_user("test@example.org", "Password123", "candidate", APPROVAL_STATUS_APPROVED)

    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "test@example.org",
            "password": "WrongPassword",
        },
    )
    assert res.status_code == 401
    body = res.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == "AUTHENTICATION_FAILED"


def test_current_user_profile_requires_auth(client):
    """Test /me endpoint rejects unauthenticated request."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_change_password_workflow(client, app):
    """Test user can change password with validation."""
    with app.app_context():
        create_test_user("user_cp@example.org", "OldPassword123", "candidate", APPROVAL_STATUS_APPROVED)

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "user_cp@example.org", "password": "OldPassword123"},
    )
    token = login_res.get_json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong current password fails
    wrong_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": "WrongCurrentPassword",
            "new_password": "NewPassword123",
            "confirm_password": "NewPassword123",
        },
    )
    assert wrong_res.status_code == 400

    # Correct current password succeeds
    succ_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={
            "current_password": "OldPassword123",
            "new_password": "NewPassword123",
            "confirm_password": "NewPassword123",
        },
    )
    assert succ_res.status_code == 200

    # Login with new password succeeds
    login_new = client.post(
        "/api/v1/auth/login",
        json={"email": "user_cp@example.org", "password": "NewPassword123"},
    )
    assert login_new.status_code == 200


def test_admin_user_approval_and_disable_workflow(client, app):
    """Test admin can list users, approve pending user, and disable user."""
    with app.app_context():
        admin = create_test_user("admin_test@example.org", "AdminPass123", "admin", APPROVAL_STATUS_APPROVED)
        candidate = create_test_user("cand_test@example.org", "CandPass123", "candidate", APPROVAL_STATUS_PENDING)
        cand_id = str(candidate.id)

    # Admin logs in
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_test@example.org", "password": "AdminPass123"},
    )
    admin_token = admin_login.get_json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # List users
    list_res = client.get("/api/v1/auth/users", headers=admin_headers)
    assert list_res.status_code == 200
    users_data = list_res.get_json()["data"]
    assert len(users_data) >= 2

    # Candidate currently cannot login
    cand_login = client.post(
        "/api/v1/auth/login",
        json={"email": "cand_test@example.org", "password": "CandPass123"},
    )
    assert cand_login.status_code == 401

    # Admin approves candidate
    appr_res = client.post(f"/api/v1/auth/users/{cand_id}/approve", headers=admin_headers)
    assert appr_res.status_code == 200
    assert appr_res.get_json()["data"]["approval_status"] == APPROVAL_STATUS_APPROVED

    # Now candidate can login
    cand_login_ok = client.post(
        "/api/v1/auth/login",
        json={"email": "cand_test@example.org", "password": "CandPass123"},
    )
    assert cand_login_ok.status_code == 200
    cand_token = cand_login_ok.get_json()["data"]["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    # Ordinary candidate cannot access admin user list -> 403 Forbidden
    cand_forbidden = client.get("/api/v1/auth/users", headers=cand_headers)
    assert cand_forbidden.status_code == 403

    # Admin disables candidate
    dis_res = client.post(f"/api/v1/auth/users/{cand_id}/disable", headers=admin_headers)
    assert dis_res.status_code == 200
    assert dis_res.get_json()["data"]["approval_status"] == APPROVAL_STATUS_DISABLED

    # Candidate cannot login anymore
    cand_login_dis = client.post(
        "/api/v1/auth/login",
        json={"email": "cand_test@example.org", "password": "CandPass123"},
    )
    assert cand_login_dis.status_code == 401

    # Candidate's existing token is immediately rejected on protected endpoint
    cand_token_rejected = client.get("/api/v1/auth/me", headers=cand_headers)
    assert cand_token_rejected.status_code == 401
