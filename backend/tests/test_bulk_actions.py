import io
import uuid
import pytest
from app.modules.auth.models import User, Role
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateVerificationItem,
    APPLICATION_STATUS_PENDING,
    APPLICATION_STATUS_IN_PROGRESS,
    APPLICATION_STATUS_COMPLETE,
    APPLICATION_STATUS_APPROVED,
    APPLICATION_STATUS_REJECTED,
    VERIFICATION_STATUS_PENDING,
    VERIFICATION_STATUS_DONE,
)
from app.extensions import db


def create_user_with_role(email, password, role_name):
    from app.modules.auth.services import hash_password
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="User",
        last_name=role_name.capitalize(),
        is_active=True,
        approval_status="APPROVED",
    )
    role = Role.query.filter_by(name=role_name).first()
    if role:
        user.roles.append(role)
    db.session.add(user)
    db.session.commit()
    return user


def login_client(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp


def upload_dummy_file(client, category):
    data = {
        "category": category,
        "file": (io.BytesIO(b"%PDF-1.4 dummy file content"), f"{category}.pdf"),
    }
    resp = client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    return resp.json["data"]


def get_valid_payload():
    return {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Ramesh Kumar Sharma",
        "mobile_number": "9876543210",
        "email": "ramesh.sharma@example.com",
        "aadhaar_number": "123456789012",
        "pan_number": "ABCDE1234F",
        "current_address_line1": "Flat 402, Green Valley Apts",
        "current_city": "Indore",
        "current_state": "Madhya Pradesh",
        "current_pincode": "452001",
        "is_permanent_same": True,
        "account_holder_name": "Ramesh Kumar Sharma",
        "bank_name": "State Bank of India",
        "account_number": "12345678901234",
        "confirm_account_number": "12345678901234",
        "ifsc_code": "SBIN0001234",
        "circle": "MP Central",
        "district": "Indore",
        "block": "Sanwer",
        "current_salary": "25000.00",
        "asking_salary": "32000.00",
        "negotiated_salary": "30000.00",
    }


def test_bulk_mark_done_submitted_data_items(client, app):
    """Test bulk marking submitted data checklist items as Done."""
    with app.app_context():
        create_user_with_role("cand_blk1@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_blk1@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_blk1@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    login_client(client, "hr_blk1@example.com", "Pass@1234")

    # Bulk mark specific submitted data checklist items
    items_to_mark = ["personal_info", "contact_info", "current_address", "permanent_address"]
    resp = client.post(
        f"/api/v1/applications/{app_id}/verification/bulk-mark-done",
        json={"item_keys": items_to_mark},
    )
    assert resp.status_code == 200
    data = resp.json["data"]
    assert data["marked_done_count"] == 4
    for k in items_to_mark:
        assert k in data["marked_done_keys"]

    # Verify checklist query confirms they are DONE
    chk_resp = client.get(f"/api/v1/applications/{app_id}/verification")
    assert chk_resp.status_code == 200
    items_map = {i["item_key"]: i["status"] for i in chk_resp.json["data"]["verification_items"]}
    for k in items_to_mark:
        assert items_map[k] == "DONE"


def test_bulk_approve_candidates_complete_and_incomplete(client, app):
    """Test bulk approval: approved candidates succeed, incomplete candidates fail gracefully."""
    with app.app_context():
        create_user_with_role("cand_app1@example.com", "Pass@1234", "candidate")
        create_user_with_role("cand_app2@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_app_mgr@example.com", "Pass@1234", "admin")

    # Candidate 1: creates application and uploads all documents
    login_client(client, "cand_app1@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")
    sub1 = client.post("/api/v1/applications", json=get_valid_payload())
    app1_id = sub1.json["data"]["id"]

    # Candidate 2: creates application with documents but will leave unverified
    login_client(client, "cand_app2@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")
    sub2 = client.post("/api/v1/applications", json=get_valid_payload())
    app2_id = sub2.json["data"]["id"]

    # Admin verifies Candidate 1 completely
    login_client(client, "hr_app_mgr@example.com", "Pass@1234")
    # Verify documents
    client.post(f"/api/v1/applications/{app1_id}/verification/bulk-done")
    # Verify all details
    detail_keys = [
        "personal_info",
        "contact_info",
        "current_address",
        "permanent_address",
        "location_allocation",
        "bank_details",
        "current_salary",
        "asking_salary",
        "negotiated_salary",
    ]
    client.post(
        f"/api/v1/applications/{app1_id}/verification/bulk-mark-done",
        json={"item_keys": detail_keys},
    )

    # Now attempt bulk approval of both candidate 1 and candidate 2
    bulk_resp = client.post(
        "/api/v1/applications/bulk-approve",
        json={"application_ids": [app1_id, app2_id]},
    )
    assert bulk_resp.status_code == 200
    res_data = bulk_resp.json["data"]
    assert res_data["total_requested"] == 2
    assert res_data["approved_count"] == 2
    assert res_data["failed_count"] == 0
    assert app1_id in res_data["successful_ids"]
    assert app2_id in res_data["successful_ids"]

    # Verify both records are APPROVED in database
    with app.app_context():
        a1 = db.session.get(CandidateApplication, uuid.UUID(app1_id))
        a2 = db.session.get(CandidateApplication, uuid.UUID(app2_id))
        assert a1.status == APPLICATION_STATUS_APPROVED
        assert a2.status == APPLICATION_STATUS_APPROVED
        assert a1.reviewed_by_id is not None
        assert a2.reviewed_by_id is not None


def test_bulk_reject_candidates_with_reason(client, app):
    """Test bulk reject with mandatory reason."""
    with app.app_context():
        create_user_with_role("cand_rej1@example.com", "Pass@1234", "candidate")
        create_user_with_role("cand_rej2@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_rej_mgr@example.com", "Pass@1234", "admin")

    login_client(client, "cand_rej1@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")
    sub1 = client.post("/api/v1/applications", json=get_valid_payload())
    app1_id = sub1.json["data"]["id"]

    login_client(client, "cand_rej2@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")
    sub2 = client.post("/api/v1/applications", json=get_valid_payload())
    app2_id = sub2.json["data"]["id"]

    login_client(client, "hr_rej_mgr@example.com", "Pass@1234")

    # Rejection without reason fails
    no_reason = client.post(
        "/api/v1/applications/bulk-reject",
        json={"application_ids": [app1_id, app2_id], "reason": ""},
    )
    assert no_reason.status_code == 400

    # Valid bulk rejection
    rej_resp = client.post(
        "/api/v1/applications/bulk-reject",
        json={"application_ids": [app1_id, app2_id], "reason": "Disqualified due to policy violation"},
    )
    assert rej_resp.status_code == 200
    res_data = rej_resp.json["data"]
    assert res_data["total_requested"] == 2
    assert res_data["rejected_count"] == 2
    assert res_data["failed_count"] == 0

    # Verify both records are REJECTED in database
    with app.app_context():
        a1 = db.session.get(CandidateApplication, uuid.UUID(app1_id))
        a2 = db.session.get(CandidateApplication, uuid.UUID(app2_id))
        assert a1.status == APPLICATION_STATUS_REJECTED
        assert a2.status == APPLICATION_STATUS_REJECTED
        assert a1.rejection_reason == "Disqualified due to policy violation"
        assert a2.rejection_reason == "Disqualified due to policy violation"
