import io
import os
import hashlib
import uuid
from decimal import Decimal
import pytest
from app.extensions import db
from app.modules.auth.models import User, Role, AuditLog
from app.modules.auth.services import hash_password
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateDocument,
    CandidateVerificationItem,
    APPLICATION_STATUS_APPROVED,
    APPLICATION_STATUS_PENDING,
)
from app.modules.letters.models import (
    CandidateLetter,
    DocumentTemplate,
    TEMPLATE_TYPE_LOI,
    TEMPLATE_TYPE_OFFER,
    LETTER_STATUS_DRAFT,
)
from app.modules.letters.services import LetterTemplateService, get_templates_storage_dir


def create_user_with_role(email, password, role_name):
    user = User(
        email=email,
        username=email.split("@")[0],
        password_hash=hash_password(password),
        first_name="Test",
        last_name=role_name.capitalize(),
        is_active=True,
        is_verified=True,
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
    assert resp.status_code == 200, f"Login failed for {email}: {resp.json}"
    return {"Authorization": f"Bearer {resp.json['data']['access_token']}"}


def upload_dummy_file(client, headers, category):
    data = {
        "file": (io.BytesIO(b"%PDF-1.4 sample content for document"), f"{category}.pdf"),
        "category": category,
    }
    resp = client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        headers=headers,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    return resp.json["data"]


def test_synthetic_case_1_complete_candidate(app):
    """Synthetic Case 1: Candidate with all details completed and documents uploaded."""
    with app.app_context():
        create_user_with_role("cand_c1@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_c1@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    hr_client = app.test_client()

    # Candidate uploads docs and submits full form
    cand_headers = login_client(cand_client, "cand_c1@example.com", "Pass@1234")
    upload_dummy_file(cand_client, cand_headers, "aadhaar_card")
    upload_dummy_file(cand_client, cand_headers, "pan_card")
    upload_dummy_file(cand_client, cand_headers, "bank_passbook")

    payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Rajesh Kumar Sharma",
        "mobile_number": "9876543210",
        "email": "rajesh.k@example.com",
        "aadhaar_number": "987654321012",
        "pan_number": "ABCDE1234F",
        "current_address_line1": "123 Civil Lines",
        "current_city": "Jaipur",
        "current_state": "Rajasthan",
        "current_pincode": "302001",
        "is_permanent_same": True,
        "permanent_address_line1": "123 Civil Lines",
        "permanent_city": "Jaipur",
        "permanent_state": "Rajasthan",
        "permanent_pincode": "302001",
        "account_holder_name": "Rajesh Kumar Sharma",
        "bank_name": "State Bank of India",
        "account_number": "12345678901",
        "confirm_account_number": "12345678901",
        "ifsc_code": "SBIN0001234",
        "circle": "Rajasthan",
        "district": "Jaipur",
        "block": "Amber",
        "current_salary": "35000.00",
        "asking_salary": "42000.00",
        "negotiated_salary": "40000.00",
    }
    sub_resp = cand_client.post("/api/v1/applications", json=payload, headers=cand_headers)
    assert sub_resp.status_code == 201, f"Submission failed: {sub_resp.json}"
    app_id = sub_resp.json["data"]["id"]

    # HR logs in and approves candidate
    hr_headers = login_client(hr_client, "hr_c1@example.com", "Pass@1234")
    appr_resp = hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json["data"]["status"] == "APPROVED"
    assert appr_resp.json["data"]["reviewed_by_name"] == "Test Reviewer"

    # Verify persistence
    get_resp = hr_client.get(f"/api/v1/applications/{app_id}", headers=hr_headers)
    assert get_resp.status_code == 200
    assert get_resp.json["data"]["status"] == "APPROVED"

    # Generate letters
    letters_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert letters_resp.status_code == 200
    letters_data = letters_resp.json["data"]
    loi = letters_data["letter_of_intent"]
    offer = letters_data["offer_letter"]
    assert loi["field_values"]["candidate_full_name"] == "Rajesh Kumar Sharma"
    assert str(offer["field_values"]["monthly_salary"]).replace(",", "") == "40000"

    # Preview email and download letter
    prev_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters/email-preview", headers=hr_headers)
    assert prev_resp.status_code == 200
    assert "Rajesh Kumar Sharma" in prev_resp.json["data"]["html"]

    dl_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters/offer_letter/download", headers=hr_headers)
    assert dl_resp.status_code == 200


def test_synthetic_case_2_missing_details_candidate(app):
    """Synthetic Case 2: Candidate with several missing details (no address, no salary, no location)."""
    with app.app_context():
        create_user_with_role("cand_c2@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_c2@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    hr_client = app.test_client()

    cand_headers = login_client(cand_client, "cand_c2@example.com", "Pass@1234")
    upload_dummy_file(cand_client, cand_headers, "aadhaar_card")

    # Incomplete payload with many empty fields
    incomplete_payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Sunil Verma",
        "mobile_number": "9123456780",
        "email": "sunil.v@example.com",
        "aadhaar_number": "",
        "pan_number": "",
        "current_address_line1": "",
        "current_city": "",
        "current_state": "",
        "current_pincode": "",
        "is_permanent_same": False,
        "permanent_address_line1": "",
        "account_holder_name": "",
        "bank_name": "",
        "account_number": "",
        "ifsc_code": "",
        "circle": "",
        "district": "",
        "block": "",
        "current_salary": "",
        "asking_salary": "",
        "negotiated_salary": "",
    }
    sub_resp = cand_client.post("/api/v1/applications", json=incomplete_payload, headers=cand_headers)
    assert sub_resp.status_code == 201, f"Submission failed: {sub_resp.json}"
    app_id = sub_resp.json["data"]["id"]

    # HR approves candidate despite incomplete details
    hr_headers = login_client(hr_client, "hr_c2@example.com", "Pass@1234")
    appr_resp = hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json["data"]["status"] == "APPROVED"
    assert appr_resp.json["data"]["reviewed_by_name"] == "Test Reviewer"

    # Persists after fresh query
    get_resp = hr_client.get(f"/api/v1/applications/{app_id}", headers=hr_headers)
    assert get_resp.status_code == 200
    assert get_resp.json["data"]["status"] == "APPROVED"

    # Letters can be generated with available data; missing fields are blank, NOT fabricated
    letters_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert letters_resp.status_code == 200
    letters_data = letters_resp.json["data"]
    loi_fields = letters_data["letter_of_intent"]["field_values"]
    offer_fields = letters_data["offer_letter"]["field_values"]

    # Name is populated from available data
    assert loi_fields["candidate_full_name"] == "Sunil Verma"
    # Address is blank, not "None, None - None"
    assert loi_fields["candidate_address"] == ""
    # Location is blank, not "India"
    assert loi_fields["approved_location"] == ""
    # Salary is blank, not a default "40000"
    assert offer_fields.get("monthly_salary", "") in ("", None)
    assert offer_fields.get("basic_salary", "") in ("", None)
    assert offer_fields.get("hra", "") in ("", None)

    # Preview email and download letter works cleanly without errors
    prev_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters/email-preview", headers=hr_headers)
    assert prev_resp.status_code == 200
    assert "Sunil Verma" in prev_resp.json["data"]["html"]

    dl_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters/offer_letter/download", headers=hr_headers)
    assert dl_resp.status_code == 200


def test_synthetic_case_3_candidate_with_no_valid_email(app):
    """Synthetic Case 3: Candidate with no valid email address."""
    with app.app_context():
        create_user_with_role("cand_c3@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_c3@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    hr_client = app.test_client()

    cand_headers = login_client(cand_client, "cand_c3@example.com", "Pass@1234")
    no_email_payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Ravi Shankar",
        "mobile_number": "9000000001",
        "email": "",  # Empty email
    }
    sub_resp = cand_client.post("/api/v1/applications", json=no_email_payload, headers=cand_headers)
    assert sub_resp.status_code == 201, f"Submission failed: {sub_resp.json}"
    app_id = sub_resp.json["data"]["id"]

    # HR approves candidate
    hr_headers = login_client(hr_client, "hr_c3@example.com", "Pass@1234")
    appr_resp = hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json["data"]["status"] == "APPROVED"

    # Letter generation works cleanly
    letters_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert letters_resp.status_code == 200

    # Sending email must be blocked with a clear message explaining why
    send_resp = hr_client.post(f"/api/v1/applications/{app_id}/letters/send", headers=hr_headers, json={})
    assert send_resp.status_code == 400
    assert "email" in send_resp.json["message"].lower()

    # Crucially: Candidate approval and generated letters remain intact!
    check_app = hr_client.get(f"/api/v1/applications/{app_id}", headers=hr_headers)
    assert check_app.json["data"]["status"] == "APPROVED"

    check_letters = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert check_letters.status_code == 200
    assert check_letters.json["data"]["letter_of_intent"] is not None
    assert check_letters.json["data"]["offer_letter"] is not None


def test_synthetic_case_4_candidate_without_uploaded_documents(app):
    """Synthetic Case 4: Candidate without uploaded documents."""
    with app.app_context():
        create_user_with_role("cand_c4@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_c4@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    hr_client = app.test_client()

    # Candidate submits application without uploading any documents
    cand_headers = login_client(cand_client, "cand_c4@example.com", "Pass@1234")
    payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Anil Mehta",
        "mobile_number": "9111222333",
        "email": "anil.m@example.com",
    }
    sub_resp = cand_client.post("/api/v1/applications", json=payload, headers=cand_headers)
    assert sub_resp.status_code == 201, f"Submission failed: {sub_resp.json}"
    app_id = sub_resp.json["data"]["id"]

    # HR approves candidate
    hr_headers = login_client(hr_client, "hr_c4@example.com", "Pass@1234")
    appr_resp = hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    assert appr_resp.status_code == 200
    assert appr_resp.json["data"]["status"] == "APPROVED"

    # Check documents: missing documents must NOT be marked uploaded or verified!
    with app.app_context():
        docs = CandidateDocument.query.filter_by(application_id=uuid.UUID(app_id)).all()
        assert len(docs) == 0
        items = CandidateVerificationItem.query.filter_by(application_id=uuid.UUID(app_id)).all()
        doc_items = [it for it in items if it.item_key.startswith("doc_")]
        for di in doc_items:
            assert di.status == "PENDING"
            assert di.verified_by_id is None

    # Letters can still be generated for this approved candidate
    letters_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert letters_resp.status_code == 200
    assert letters_resp.json["data"]["letter_of_intent"]["field_values"]["candidate_full_name"] == "Anil Mehta"


def test_synthetic_case_5_unauthorized_user_blocked(app):
    """Synthetic Case 5: Unauthorized user attempting approval or letter operations."""
    with app.app_context():
        create_user_with_role("cand_c5@example.com", "Pass@1234", "candidate")
        create_user_with_role("unauth_user@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_c5@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    unauth_client = app.test_client()
    hr_client = app.test_client()

    cand_headers = login_client(cand_client, "cand_c5@example.com", "Pass@1234")
    payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Pooja Sharma",
        "mobile_number": "9444555666",
        "email": "pooja.s@example.com",
    }
    sub_resp = cand_client.post("/api/v1/applications", json=payload, headers=cand_headers)
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    unauth_headers = login_client(unauth_client, "unauth_user@example.com", "Pass@1234")

    # 1. Unauthorized approval attempt -> 403 Forbidden
    appr_resp = unauth_client.post(f"/api/v1/applications/{app_id}/approve", headers=unauth_headers)
    assert appr_resp.status_code == 403

    # 2. Authorized HR approves candidate
    hr_headers = login_client(hr_client, "hr_c5@example.com", "Pass@1234")
    hr_appr = hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    assert hr_appr.status_code == 200

    # 3. Unauthorized user attempts to view/retrieve letters for another candidate's application -> 403 Forbidden
    letters_resp = unauth_client.get(f"/api/v1/applications/{app_id}/letters", headers=unauth_headers)
    assert letters_resp.status_code == 403

    # 4. Unauthorized user attempts to edit letter draft -> 403 Forbidden
    patch_resp = unauth_client.patch(f"/api/v1/applications/{app_id}/letters/offer_letter", headers=unauth_headers, json={"field_values": {}})
    assert patch_resp.status_code == 403

    # 5. Unauthorized user attempts letter dispatch -> 403 Forbidden
    send_resp = unauth_client.post(f"/api/v1/applications/{app_id}/letters/send", headers=unauth_headers, json={})
    assert send_resp.status_code == 403


def test_master_template_integrity_preserved(app):
    """Verify that generating candidate letters does NOT alter or overwrite master templates."""
    with app.app_context():
        LetterTemplateService.ensure_default_templates()
        tmpl_dir = get_templates_storage_dir()
        loi_path = os.path.join(tmpl_dir, "letter_of_intent_v1.docx")
        offer_path = os.path.join(tmpl_dir, "offer_letter_v1.docx")

        def file_hash(path):
            with open(path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()

        loi_hash_before = file_hash(loi_path)
        offer_hash_before = file_hash(offer_path)

        create_user_with_role("cand_tmpl@example.com", "Pass@1234", "candidate")
        create_user_with_role("hr_tmpl@example.com", "Pass@1234", "reviewer")

    cand_client = app.test_client()
    hr_client = app.test_client()

    # Candidate creates application
    cand_headers = login_client(cand_client, "cand_tmpl@example.com", "Pass@1234")
    payload = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Template Test Candidate",
        "mobile_number": "9998887776",
        "email": "tmpl.c@example.com",
        "current_salary": "25000",
        "negotiated_salary": "28000",
    }
    sub_resp = cand_client.post("/api/v1/applications", json=payload, headers=cand_headers)
    assert sub_resp.status_code == 201
    app_id = sub_resp.json["data"]["id"]

    hr_headers = login_client(hr_client, "hr_tmpl@example.com", "Pass@1234")
    # Approve candidate
    hr_client.post(f"/api/v1/applications/{app_id}/approve", headers=hr_headers)
    # Generate letters
    letters_resp = hr_client.get(f"/api/v1/applications/{app_id}/letters", headers=hr_headers)
    assert letters_resp.status_code == 200

    # Verify candidate copy was created separately and stored
    with app.app_context():
        loi_letter = CandidateLetter.query.filter_by(application_id=uuid.UUID(app_id), letter_type=TEMPLATE_TYPE_LOI).first()
        assert loi_letter is not None
        assert loi_letter.docx_storage_path != loi_path
        assert os.path.exists(loi_letter.docx_storage_path)

    # Master templates must have identical hash (unmodified)
    with app.app_context():
        assert file_hash(loi_path) == loi_hash_before
        assert file_hash(offer_path) == offer_hash_before
