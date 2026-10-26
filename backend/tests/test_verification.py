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
        "file": (io.BytesIO(b"%PDF-1.4 sample document content"), f"{category}.pdf"),
        "category": category,
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


def test_submission_automatically_generates_verification_checklist(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_v1@example.com", "Pass@1234", "candidate")

    login_client(client, "cand_v1@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    resp = client.post("/api/v1/applications", json=get_valid_payload())
    assert resp.status_code == 201
    app_data = resp.json["data"]
    app_id = app_data["id"]

    assert app_data["status"] == APPLICATION_STATUS_PENDING
    progress = app_data["verification_progress"]
    assert progress["total_items"] > 0
    assert progress["completed_items"] == 0
    assert progress["percentage"] == 0

    with app.app_context():
        items = CandidateVerificationItem.query.filter_by(application_id=uuid.UUID(app_id)).all()
        assert len(items) >= 10
        item_keys = {it.item_key for it in items}
        assert "personal_info" in item_keys
        assert "contact_info" in item_keys
        assert "current_address" in item_keys
        assert "permanent_address" in item_keys
        assert "location_allocation" in item_keys
        assert "bank_details" in item_keys
        assert "current_salary" in item_keys
        assert "asking_salary" in item_keys
        assert "negotiated_salary" in item_keys
        assert "doc_aadhaar" in item_keys
        assert "doc_pan" in item_keys
        assert "doc_bank_passbook" in item_keys

        for it in items:
            assert it.status == VERIFICATION_STATUS_PENDING
            assert it.verified_by_id is None


def test_candidate_cannot_verify_own_application(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_v2@example.com", "Pass@1234", "candidate")

    login_client(client, "cand_v2@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "cancelled_cheque")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    # Candidate attempts to mark item done -> 403 Forbidden
    verify_resp = client.post(f"/api/v1/applications/{app_id}/verification/personal_info/done")
    assert verify_resp.status_code == 403


def test_authorized_hr_can_verify_items_individually_and_track_status(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_v3@example.com", "Pass@1234", "candidate")
        reviewer = create_user_with_role("hr_reviewer@example.com", "Pass@1234", "reviewer")

    # Candidate submits application
    login_client(client, "cand_v3@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    # HR Reviewer logs in
    login_client(client, "hr_reviewer@example.com", "Pass@1234")

    # Fetch verification checklist
    chk_resp = client.get(f"/api/v1/applications/{app_id}/verification")
    assert chk_resp.status_code == 200
    chk_data = chk_resp.json["data"]
    assert chk_data["application_status"] == APPLICATION_STATUS_PENDING
    items = chk_data["verification_items"]
    assert len(items) > 0

    # Mark one item as Done: personal_info
    done_resp = client.post(
        f"/api/v1/applications/{app_id}/verification/personal_info/done",
        json={"remarks": "Aadhaar and PAN name match"},
    )
    assert done_resp.status_code == 200
    done_data = done_resp.json["data"]
    assert done_data["item"]["status"] == VERIFICATION_STATUS_DONE
    assert done_data["item"]["verified_by_name"] == "User Reviewer"
    assert done_data["item"]["remarks"] == "Aadhaar and PAN name match"
    # Status transitioned to IN_PROGRESS
    assert done_data["application_status"] == APPLICATION_STATUS_IN_PROGRESS
    assert done_data["verification_progress"]["completed_items"] == 1

    # Verify other items are untouched
    with app.app_context():
        contact_item = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id), item_key="contact_info"
        ).first()
        assert contact_item.status == VERIFICATION_STATUS_PENDING

    # Mark all remaining items done
    keys_to_verify = [
        "contact_info",
        "current_address",
        "permanent_address",
        "location_allocation",
        "bank_details",
        "current_salary",
        "asking_salary",
        "negotiated_salary",
        "doc_aadhaar",
        "doc_pan",
        "doc_bank_passbook",
    ]

    for k in keys_to_verify:
        r = client.post(f"/api/v1/applications/{app_id}/verification/{k}/done")
        assert r.status_code == 200

    # Check overall status is now VERIFICATION_COMPLETE
    final_chk = client.get(f"/api/v1/applications/{app_id}/verification")
    assert final_chk.status_code == 200
    assert final_chk.json["data"]["application_status"] == APPLICATION_STATUS_COMPLETE
    assert final_chk.json["data"]["verification_progress"]["percentage"] == 100

    # Reset one item to Pending
    reset_resp = client.post(f"/api/v1/applications/{app_id}/verification/personal_info/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json["data"]["item"]["status"] == VERIFICATION_STATUS_PENDING
    # Overall status reverted to IN_PROGRESS
    assert reset_resp.json["data"]["application_status"] == APPLICATION_STATUS_IN_PROGRESS


def test_sensitive_data_masking_and_authorized_unmasking(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_v4@example.com", "Pass@1234", "candidate")
        admin = create_user_with_role("admin_v@example.com", "Pass@1234", "admin")

    login_client(client, "cand_v4@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    # In list endpoint, sensitive fields are masked
    list_resp = client.get("/api/v1/applications")
    assert list_resp.status_code == 200
    app_row = list_resp.json["data"][0]
    assert "••••" in app_row["aadhaar_masked"]
    assert "••••" in app_row["pan_masked"]
    assert "••••" in app_row["account_masked"]
    assert app_row["aadhaar_number"] is None
    assert app_row["pan_number"] is None
    assert app_row["account_number"] is None

    # Admin unmask view
    login_client(client, "admin_v@example.com", "Pass@1234")
    unmask_resp = client.get(f"/api/v1/applications/{app_id}?unmask=true")
    assert unmask_resp.status_code == 200
    detail = unmask_resp.json["data"]
    assert detail["aadhaar_number"] == "123456789012"
    assert detail["pan_number"] == "ABCDE1234F"
    assert detail["account_number"] == "12345678901234"


def test_approve_workflow_blocks_incomplete_and_allows_when_complete(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_appr@example.com", "Pass@1234", "candidate")
        reviewer = create_user_with_role("hr_appr@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_appr@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    app_id = sub_resp.json["data"]["id"]

    # Candidate attempts to approve -> 403 Forbidden
    cand_appr = client.post(f"/api/v1/applications/{app_id}/approve")
    assert cand_appr.status_code == 403

    # Reviewer attempts to approve while items are pending -> 400 Validation Error
    login_client(client, "hr_appr@example.com", "Pass@1234")
    premature_appr = client.post(f"/api/v1/applications/{app_id}/approve")
    assert premature_appr.status_code == 400
    assert "cannot be approved until all required checks are completed" in premature_appr.json["message"]

    # Bulk verify eligible uploaded documents (marks 3 uploaded docs)
    bulk_resp = client.post(f"/api/v1/applications/{app_id}/verification/bulk-done")
    assert bulk_resp.status_code == 200
    assert bulk_resp.json["data"]["marked_done_count"] == 3
    # Status is IN_PROGRESS because detail checks are still pending
    assert bulk_resp.json["data"]["application_status"] == APPLICATION_STATUS_IN_PROGRESS

    # Approval is still blocked because personal, address, salary details are pending
    blocked_appr = client.post(f"/api/v1/applications/{app_id}/approve")
    assert blocked_appr.status_code == 400
    assert "cannot be approved until all required checks are completed" in blocked_appr.json["message"]

    # Verify all remaining mandatory detail items individually
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
    for k in detail_keys:
        client.post(f"/api/v1/applications/{app_id}/verification/{k}/done")

    # Now all mandatory items are done, approve candidate -> 200 OK
    appr_resp = client.post(f"/api/v1/applications/{app_id}/approve")
    assert appr_resp.status_code == 200
    appr_data = appr_resp.json["data"]
    assert appr_data["status"] == "APPROVED"
    assert appr_data["reviewed_by_name"] == "User Reviewer"
    assert appr_data["reviewed_at"] is not None

    # Fetch application details to verify persistence
    get_resp = client.get(f"/api/v1/applications/{app_id}")
    assert get_resp.status_code == 200
    assert get_resp.json["data"]["status"] == "APPROVED"
    assert get_resp.json["data"]["reviewed_by_name"] == "User Reviewer"


def test_reject_workflow_requires_reason_and_persists(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_rej@example.com", "Pass@1234", "candidate")
        reviewer = create_user_with_role("hr_rej@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_rej@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_valid_payload())
    app_id = sub_resp.json["data"]["id"]

    # Candidate attempts to reject -> 403 Forbidden
    cand_rej = client.post(f"/api/v1/applications/{app_id}/reject", json={"reason": "Self reject"})
    assert cand_rej.status_code == 403

    # Reviewer attempts to reject without reason -> 400 Validation Error
    login_client(client, "hr_rej@example.com", "Pass@1234")
    no_reason = client.post(f"/api/v1/applications/{app_id}/reject", json={"reason": ""})
    assert no_reason.status_code == 400

    # Reject with valid reason
    rej_resp = client.post(
        f"/api/v1/applications/{app_id}/reject",
        json={"reason": "Aadhaar photo does not match profile information."},
    )
    assert rej_resp.status_code == 200
    rej_data = rej_resp.json["data"]
    assert rej_data["status"] == "REJECTED"
    assert rej_data["rejection_reason"] == "Aadhaar photo does not match profile information."
    assert rej_data["reviewed_by_name"] == "User Reviewer"

    # Verify persistence
    get_resp = client.get(f"/api/v1/applications/{app_id}")
    assert get_resp.status_code == 200
    assert get_resp.json["data"]["status"] == "REJECTED"
    assert get_resp.json["data"]["rejection_reason"] == "Aadhaar photo does not match profile information."


def test_bulk_verification_workflow(client, app):
    with app.app_context():
        candidate = create_user_with_role("cand_bulk@example.com", "Pass@1234", "candidate")
        reviewer = create_user_with_role("hr_bulk@example.com", "Pass@1234", "reviewer")

    # Upload required documents (3 files)
    login_client(client, "cand_bulk@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    payload = get_valid_payload()
    sub_resp = client.post("/api/v1/applications", json=payload)
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    login_client(client, "hr_bulk@example.com", "Pass@1234")

    # Bulk verify documents only (the default)
    bulk_resp = client.post(f"/api/v1/applications/{app_id}/verification/bulk-done")
    assert bulk_resp.status_code == 200
    bulk_data = bulk_resp.json["data"]
    # Exactly the 3 uploaded documents marked as verified
    assert bulk_data["marked_done_count"] == 3
    assert set(bulk_data["marked_done_keys"]) == {"doc_aadhaar", "doc_pan", "doc_bank_passbook"}
    # Candidate status is IN_PROGRESS, NOT APPROVED and NOT COMPLETE
    assert bulk_data["application_status"] == APPLICATION_STATUS_IN_PROGRESS
    assert bulk_data["application_status"] != "APPROVED"

    # Non-document checks remain PENDING
    with app.app_context():
        personal_item = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id), item_key="personal_info"
        ).first()
        assert personal_item.status == VERIFICATION_STATUS_PENDING
        current_addr = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id), item_key="current_address"
        ).first()
        assert current_addr.status == VERIFICATION_STATUS_PENDING

    # Attempting candidate approval fails because detail checks are still pending
    premature_appr = client.post(f"/api/v1/applications/{app_id}/approve")
    assert premature_appr.status_code == 400
    assert "cannot be approved until all required checks are completed" in premature_appr.json["message"]

