import io
import uuid
import pytest
from app.modules.auth.models import User, Role, AuditLog
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateDocument,
    CandidateVerificationItem,
    APPLICATION_STATUS_PENDING,
    APPLICATION_STATUS_IN_PROGRESS,
    APPLICATION_STATUS_COMPLETE,
    APPLICATION_STATUS_APPROVED,
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
    user_id = user.id
    return user_id


def login_client(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp


def upload_dummy_file(client, category):
    data = {
        "file": (io.BytesIO(b"%PDF-1.4 sample document content for verification test"), f"{category}.pdf"),
        "category": category,
    }
    resp = client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    return resp.json["data"]


def get_candidate_payload():
    return {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Suresh Raina",
        "mobile_number": "9876543219",
        "email": f"suresh_{uuid.uuid4().hex[:6]}@example.com",
        "aadhaar_number": "999988887777",
        "pan_number": "ABCDE9999Z",
        "current_address_line1": "Civil Lines",
        "current_city": "Kanpur",
        "current_state": "Uttar Pradesh",
        "current_pincode": "208001",
        "is_permanent_same": True,
        "account_holder_name": "Suresh Raina",
        "bank_name": "Punjab National Bank",
        "account_number": "98765432109876",
        "confirm_account_number": "98765432109876",
        "ifsc_code": "PUNB0123400",
        "circle": "UP East",
        "district": "Kanpur Nagar",
        "block": "Kalyanpur",
        "current_salary": "30000.00",
        "asking_salary": "40000.00",
    }


def test_mark_individual_document_done_complete_flow(client, app):
    """Verify:
    1. Authorized reviewer can mark one uploaded document as done.
    2. Correct document and candidate are updated in database.
    3. Verifier identity and timestamp are stored.
    4. AuditLog action CANDIDATE_VERIFICATION_ITEM_DONE is recorded.
    5. Other documents remain PENDING.
    """
    with app.app_context():
        candidate_id = create_user_with_role("cand_mark1@example.com", "Pass@1234", "candidate")
        reviewer_id = create_user_with_role("rev_mark1@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_mark1@example.com", "Pass@1234")
    doc_aadhaar = upload_dummy_file(client, "aadhaar_card")
    doc_pan = upload_dummy_file(client, "pan_card")
    doc_passbook = upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_candidate_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    # Reviewer logs in
    login_client(client, "rev_mark1@example.com", "Pass@1234")

    # Mark doc_aadhaar done
    res = client.post(
        f"/api/v1/applications/{app_id}/verification/doc_aadhaar/done",
        json={"remarks": "Aadhaar Card verified with original UIDAI copy"},
    )
    assert res.status_code == 200
    res_data = res.json["data"]
    assert res_data["item"]["status"] == VERIFICATION_STATUS_DONE
    assert res_data["item"]["verified_by_name"] == "User Reviewer"
    assert res_data["item"]["remarks"] == "Aadhaar Card verified with original UIDAI copy"

    # Verify database persistence
    with app.app_context():
        item = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id),
            item_key="doc_aadhaar"
        ).first()
        assert item.status == VERIFICATION_STATUS_DONE
        assert item.verified_by_id == reviewer_id
        assert item.verified_at is not None

        # Verify other documents are untouched
        item_pan = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id),
            item_key="doc_pan"
        ).first()
        assert item_pan.status == VERIFICATION_STATUS_PENDING

        item_bank = CandidateVerificationItem.query.filter_by(
            application_id=uuid.UUID(app_id),
            item_key="doc_bank_passbook"
        ).first()
        assert item_bank.status == VERIFICATION_STATUS_PENDING

        # Verify audit activity recorded
        audit = AuditLog.query.filter_by(
            action="CANDIDATE_VERIFICATION_ITEM_DONE",
            resource_id=str(item.id)
        ).first()
        assert audit is not None
        assert audit.user_id == reviewer_id
        assert audit.details["item_key"] == "doc_aadhaar"


def test_unauthorized_user_cannot_verify_document(client, app):
    """Unauthorized user (candidate or user without documents:verify) cannot mark document as done."""
    with app.app_context():
        candidate_id = create_user_with_role("cand_unauth@example.com", "Pass@1234", "candidate")

    login_client(client, "cand_unauth@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_candidate_payload())
    app_id = sub_resp.json["data"]["id"]

    # Candidate attempts to mark document done -> 403 Forbidden
    res = client.post(f"/api/v1/applications/{app_id}/verification/doc_aadhaar/done")
    assert res.status_code == 403
    assert res.json["success"] is False


def test_mark_by_document_uuid_and_category(client, app):
    """Reviewer can verify directly by document UUID endpoint or category."""
    with app.app_context():
        candidate_id = create_user_with_role("cand_uuid@example.com", "Pass@1234", "candidate")
        reviewer_id = create_user_with_role("rev_uuid@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_uuid@example.com", "Pass@1234")
    doc_aadhaar = upload_dummy_file(client, "aadhaar_card")
    doc_pan = upload_dummy_file(client, "pan_card")
    doc_passbook = upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_candidate_payload())
    app_id = sub_resp.json["data"]["id"]

    login_client(client, "rev_uuid@example.com", "Pass@1234")

    # Verify doc_pan using dedicated /documents/<uuid>/verify route
    pan_id = doc_pan["id"]
    res_doc = client.post(f"/api/v1/applications/{app_id}/documents/{pan_id}/verify")
    assert res_doc.status_code == 200
    assert res_doc.json["data"]["item"]["item_key"] == "doc_pan"
    assert res_doc.json["data"]["item"]["status"] == VERIFICATION_STATUS_DONE

    # Verify doc_bank_passbook using category name in verification route
    res_cat = client.post(f"/api/v1/applications/{app_id}/verification/bank_passbook/done")
    assert res_cat.status_code == 200
    assert res_cat.json["data"]["item"]["item_key"] == "doc_bank_passbook"
    assert res_cat.json["data"]["item"]["status"] == VERIFICATION_STATUS_DONE


def test_bank_document_alternative_rule_with_passbook_or_cheque(client, app):
    """Bank document rule: either Bank Passbook OR Cancelled Cheque satisfies requirement."""
    with app.app_context():
        candidate_id = create_user_with_role("cand_bankrule@example.com", "Pass@1234", "candidate")
        reviewer_id = create_user_with_role("rev_bankrule@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_bankrule@example.com", "Pass@1234")
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    # Upload only cancelled cheque, NO bank passbook
    upload_dummy_file(client, "cancelled_cheque")

    sub_resp = client.post("/api/v1/applications", json=get_candidate_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    login_client(client, "rev_bankrule@example.com", "Pass@1234")

    # Verify all details first
    for k in ["personal_info", "contact_info", "current_address", "permanent_address", "location_allocation", "bank_details", "current_salary", "asking_salary"]:
        client.post(f"/api/v1/applications/{app_id}/verification/{k}/done")

    # Verify Aadhaar and PAN
    client.post(f"/api/v1/applications/{app_id}/verification/doc_aadhaar/done")
    client.post(f"/api/v1/applications/{app_id}/verification/doc_pan/done")

    # Candidate status is still IN_PROGRESS because bank doc is not yet verified
    chk = client.get(f"/api/v1/applications/{app_id}/verification").json["data"]
    assert chk["application_status"] == APPLICATION_STATUS_IN_PROGRESS

    # Now verify cancelled cheque
    cheque_res = client.post(f"/api/v1/applications/{app_id}/verification/doc_cancelled_cheque/done")
    assert cheque_res.status_code == 200
    assert cheque_res.json["data"]["item"]["status"] == VERIFICATION_STATUS_DONE

    # Bank alternative rule is satisfied -> application status becomes COMPLETE
    final_chk = client.get(f"/api/v1/applications/{app_id}/verification").json["data"]
    assert final_chk["application_status"] == APPLICATION_STATUS_COMPLETE


def test_bulk_verification_does_not_verify_unuploaded_optional_documents(client, app):
    """Bulk verification must only verify uploaded documents with files on disk, not unuploaded optional ones."""
    with app.app_context():
        candidate_id = create_user_with_role("cand_bulk_safe@example.com", "Pass@1234", "candidate")
        reviewer_id = create_user_with_role("rev_bulk_safe@example.com", "Pass@1234", "reviewer")

    login_client(client, "cand_bulk_safe@example.com", "Pass@1234")
    # Upload mandatory documents: Aadhaar, PAN, Passbook. Optional marksheet & employment are NOT uploaded.
    upload_dummy_file(client, "aadhaar_card")
    upload_dummy_file(client, "pan_card")
    upload_dummy_file(client, "bank_passbook")

    sub_resp = client.post("/api/v1/applications", json=get_candidate_payload())
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    login_client(client, "rev_bulk_safe@example.com", "Pass@1234")

    # Bulk verify documents
    bulk_res = client.post(f"/api/v1/applications/{app_id}/verification/bulk-done")
    assert bulk_res.status_code == 200
    data = bulk_res.json["data"]
    assert data["marked_done_count"] == 3
    assert set(data["marked_done_keys"]) == {"doc_aadhaar", "doc_pan", "doc_bank_passbook"}

    # Unuploaded optional documents are NOT marked DONE
    with app.app_context():
        items = CandidateVerificationItem.query.filter_by(application_id=uuid.UUID(app_id)).all()
        item_map = {it.item_key: it.status for it in items}
        assert item_map.get("doc_marksheet_10th") in (VERIFICATION_STATUS_PENDING, None)
        assert item_map.get("doc_marksheet_12th") in (VERIFICATION_STATUS_PENDING, None)
        assert item_map.get("doc_previous_employment") in (VERIFICATION_STATUS_PENDING, None)
        assert item_map["doc_aadhaar"] == VERIFICATION_STATUS_DONE
        assert item_map["doc_pan"] == VERIFICATION_STATUS_DONE
        assert item_map["doc_bank_passbook"] == VERIFICATION_STATUS_DONE
