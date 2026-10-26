import io
import pytest
import uuid
from sqlalchemy import select
from app.extensions import db
from app.modules.candidates.models import ApplicationRole
from tests.test_candidates import get_auth_token_for_user, get_admin_auth_token, upload_mandatory_docs


def test_admin_can_create_role_active(client, app):
    """Authorized admin can create an active designation role."""
    admin_headers = get_admin_auth_token(client)
    role_name = f"HDD Rig Specialist {uuid.uuid4().hex[:4]}"
    resp = client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={
            "name": role_name,
            "description": "Specialized drilling rig operator",
            "is_active": True,
        },
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["name"] == role_name
    assert body["data"]["is_active"] is True
    assert body["data"]["description"] == "Specialized drilling rig operator"
    assert "id" in body["data"]

    # Verify persistence in database
    with app.app_context():
        role = db.session.execute(
            select(ApplicationRole).where(ApplicationRole.name == role_name)
        ).scalar_one_or_none()
        assert role is not None
        assert role.is_active is True


def test_admin_can_create_role_inactive(client, app):
    """Admin can create a role with inactive status by default."""
    admin_headers = get_admin_auth_token(client)
    role_name = f"HDD Retired Role {uuid.uuid4().hex[:4]}"
    resp = client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={
            "name": role_name,
            "description": "Legacy designation",
            "is_active": False,
        },
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["name"] == role_name
    assert body["data"]["is_active"] is False


def test_duplicate_role_name_rejected_with_409(client, app):
    """Prevent duplicate role creation (case-insensitive)."""
    admin_headers = get_admin_auth_token(client)
    base_name = f"HDD Senior Tech {uuid.uuid4().hex[:4]}"
    # First creation
    r1 = client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={"name": base_name, "is_active": True},
    )
    assert r1.status_code == 201

    # Second creation with case variation
    r2 = client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={"name": base_name.lower(), "is_active": True},
    )
    assert r2.status_code == 409
    body = r2.get_json()
    assert body["success"] is False
    assert "already exists" in body["message"].lower()


def test_non_admin_cannot_create_or_modify_roles(client, app):
    """Ordinary user (staff/reviewer) receives HTTP 403 when creating or modifying roles."""
    user_headers = get_auth_token_for_user(client, "staff_roles@example.org", "Password123")

    # Attempt create
    resp = client.post(
        "/api/v1/applications/roles",
        headers=user_headers,
        json={"name": "Hacker Role"},
    )
    assert resp.status_code == 403

    # Attempt toggle
    with app.app_context():
        existing_role = db.session.execute(select(ApplicationRole)).scalars().first()
    if existing_role:
        toggle_resp = client.post(
            f"/api/v1/applications/roles/{existing_role.id}/toggle-active",
            headers=user_headers,
        )
        assert toggle_resp.status_code == 403


def test_admin_can_update_role_and_toggle(client, app):
    """Admin can update role details and toggle active/inactive status."""
    admin_headers = get_admin_auth_token(client)
    role_name = f"HDD Mechanics {uuid.uuid4().hex[:4]}"
    create_resp = client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={"name": role_name, "description": "Initial desc", "is_active": True},
    )
    assert create_resp.status_code == 201
    role_id = create_resp.get_json()["data"]["id"]

    # Update role
    updated_name = f"{role_name} Updated"
    update_resp = client.put(
        f"/api/v1/applications/roles/{role_id}",
        headers=admin_headers,
        json={"name": updated_name, "description": "Updated desc"},
    )
    assert update_resp.status_code == 200
    assert update_resp.get_json()["data"]["name"] == updated_name

    # Toggle to Inactive
    toggle_resp = client.post(
        f"/api/v1/applications/roles/{role_id}/toggle-active",
        headers=admin_headers,
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.get_json()["data"]["is_active"] is False

    # Toggle back to Active
    toggle_resp2 = client.post(
        f"/api/v1/applications/roles/{role_id}/toggle-active",
        headers=admin_headers,
    )
    assert toggle_resp2.status_code == 200
    assert toggle_resp2.get_json()["data"]["is_active"] is True


def test_candidate_application_with_new_dynamic_role(client, sample_valid_payload, app):
    """New active role can be chosen and successfully submitted by a candidate."""
    admin_headers = get_admin_auth_token(client)
    user_headers = get_auth_token_for_user(client, "cand_dynamic@example.org", "Password123")

    role_name = f"HDD Chief Specialist {uuid.uuid4().hex[:4]}"
    # Admin creates role
    client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={"name": role_name, "is_active": True},
    )

    # Candidate uploads mandatory documents
    upload_mandatory_docs(client, user_headers)

    # Candidate submits application with the newly created role
    payload = dict(sample_valid_payload)
    payload["role_applied"] = role_name
    payload["mobile_number"] = f"98{uuid.uuid4().int % 100000000:08d}"
    payload["aadhaar_number"] = f"{uuid.uuid4().int % 1000000000000:012d}"
    payload["pan_number"] = f"ABCDE{uuid.uuid4().int % 10000:04d}F"

    submit_resp = client.post(
        "/api/v1/applications",
        headers=user_headers,
        json=payload,
    )
    assert submit_resp.status_code == 201
    assert submit_resp.get_json()["data"]["role_applied"] == role_name


def test_candidate_application_with_deactivated_role_rejected(client, sample_valid_payload, app):
    """Attempting to submit an application with a deactivated role returns HTTP 400."""
    admin_headers = get_admin_auth_token(client)
    user_headers = get_auth_token_for_user(client, "cand_deact@example.org", "Password123")

    role_name = f"HDD Deactivated Role {uuid.uuid4().hex[:4]}"
    # Admin creates inactive role
    client.post(
        "/api/v1/applications/roles",
        headers=admin_headers,
        json={"name": role_name, "is_active": False},
    )

    # Candidate uploads mandatory documents
    upload_mandatory_docs(client, user_headers)

    # Candidate attempts to submit with deactivated role
    payload = dict(sample_valid_payload)
    payload["role_applied"] = role_name
    payload["mobile_number"] = f"98{uuid.uuid4().int % 100000000:08d}"
    payload["aadhaar_number"] = f"{uuid.uuid4().int % 1000000000000:012d}"
    payload["pan_number"] = f"ABCDE{uuid.uuid4().int % 10000:04d}F"

    submit_resp = client.post(
        "/api/v1/applications",
        headers=user_headers,
        json=payload,
    )
    res_json = submit_resp.get_json()
    assert submit_resp.status_code == 400, f"Expected 400, got {submit_resp.status_code}: {res_json}"
    assert "deactivated" in str(res_json).lower(), f"Expected deactivated in: {res_json}"
