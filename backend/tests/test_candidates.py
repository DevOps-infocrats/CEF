import io
import pytest
from app.modules.candidates.models import CandidateApplication


def get_auth_token_for_user(client, email, password):
    """Helper to register and login a user and return access token header."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "Applicant",
        },
    )
    from app.modules.auth.models import User
    from app.extensions import db
    u = User.query.filter_by(email=email).first()
    if u:
        u.approval_status = "APPROVED"
        db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def upload_sample_doc(client, headers, category, filename="sample.pdf", content=b"%PDF-1.4 sample content", mimetype="application/pdf"):
    """Helper to upload a staged document for tests."""
    data = {
        "category": category,
        "file": (io.BytesIO(content), filename, mimetype),
    }
    return client.post(
        "/api/v1/applications/documents/upload",
        data=data,
        headers=headers,
        content_type="multipart/form-data",
    )


def upload_mandatory_docs(client, headers):
    """Helper to upload all 3 mandatory document requirements: Aadhaar, PAN, and Bank Passbook."""
    upload_sample_doc(client, headers, "aadhaar_card", "aadhaar.pdf", b"%PDF-1.4 aadhaar content", "application/pdf")
    upload_sample_doc(client, headers, "pan_card", "pan.png", b"\x89PNG pan content", "image/png")
    upload_sample_doc(client, headers, "bank_passbook", "passbook.jpg", b"\xff\xd8\xff passbook content", "image/jpeg")





def test_submit_application_requires_auth(client, sample_valid_payload):
    """Test submission requires authenticated user."""
    res = client.post("/api/v1/applications", json=sample_valid_payload)
    assert res.status_code == 401


def test_submit_application_missing_mandatory_documents(client, sample_valid_payload):
    """Test application submission fails if mandatory documents are not uploaded."""
    headers = get_auth_token_for_user(client, "nodocs@example.org", "Password123")
    res = client.post("/api/v1/applications", json=sample_valid_payload, headers=headers)
    assert res.status_code == 400
    assert "Mandatory document upload required" in res.get_json()["message"]


def test_document_upload_invalid_filetype(client):
    """Test rejection of non-allowed file extension."""
    headers = get_auth_token_for_user(client, "badfile@example.org", "Password123")
    res = upload_sample_doc(client, headers, "aadhaar_card", "script.exe", b"executable", "application/octet-stream")
    assert res.status_code == 400
    assert "File type" in res.get_json()["message"]


def test_submit_application_invalid_role_or_category(client, sample_valid_payload):
    """Test rejection of non-allowed Hero category or Role."""
    headers = get_auth_token_for_user(client, "cand1@example.org", "Password123")
    upload_mandatory_docs(client, headers)

    # Invalid Hero category
    bad_payload = dict(sample_valid_payload, hero_category="Hero 3")
    res = client.post("/api/v1/applications", json=bad_payload, headers=headers)
    assert res.status_code == 400

    # Invalid Role
    bad_role_payload = dict(sample_valid_payload, role_applied="Invalid Role")
    res2 = client.post("/api/v1/applications", json=bad_role_payload, headers=headers)
    assert res2.status_code == 400


def test_submit_application_mismatched_bank_account(client, sample_valid_payload):
    """Test validation fails if confirm_account_number differs."""
    headers = get_auth_token_for_user(client, "cand2@example.org", "Password123")
    upload_mandatory_docs(client, headers)
    bad_payload = dict(sample_valid_payload, confirm_account_number="99999999999")
    res = client.post("/api/v1/applications", json=bad_payload, headers=headers)
    assert res.status_code == 400
    body = res.get_json()
    assert "confirm_account_number" in body["error"]["details"]


def test_submit_application_invalid_pan_or_aadhaar(client, sample_valid_payload):
    """Test validation enforces Aadhaar 12-digit and PAN formatting."""
    headers = get_auth_token_for_user(client, "cand3@example.org", "Password123")
    upload_mandatory_docs(client, headers)

    # Short Aadhaar
    res = client.post(
        "/api/v1/applications",
        json=dict(sample_valid_payload, aadhaar_number="12345"),
        headers=headers,
    )
    assert res.status_code == 400

    # Malformed PAN
    res2 = client.post(
        "/api/v1/applications",
        json=dict(sample_valid_payload, pan_number="INVALID_PAN"),
        headers=headers,
    )
    assert res2.status_code == 400


def test_submit_application_success_with_step4_and_step5(client, sample_valid_payload):
    """Test successful application persistence including Location, Salary, and masked data."""
    headers = get_auth_token_for_user(client, "cand4@example.org", "Password123")
    upload_mandatory_docs(client, headers)

    res = client.post("/api/v1/applications", json=sample_valid_payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()["data"]

    assert data["hero_category"] == "Hero 1"
    assert data["role_applied"] == "HDD Operate"
    assert data["application_number"].startswith("CEF-APP-")
    assert data["aadhaar_masked"] == "••••••••9012"
    assert data["pan_masked"] == "••••••234F"
    assert data["account_number_masked"] == "••••••••8901"

    # Step 4: Location & Salary fields verification
    assert data["circle"] == "Central Circle"
    assert data["district"] == "Indore"
    assert data["block"] == "Block A"
    assert float(data["current_salary"]) == 35000.0
    assert float(data["asking_salary"]) == 45000.0
    assert float(data["negotiated_salary"]) == 42000.0

    # Step 5: Documents linked
    assert len(data["documents"]) == 3


def test_cancelled_cheque_satisfies_bank_document_rule(client, sample_valid_payload):
    """Test that Cancelled Cheque satisfies the bank document requirement instead of Passbook."""
    headers = get_auth_token_for_user(client, "cheque@example.org", "Password123")
    upload_sample_doc(client, headers, "aadhaar_card", "aadhaar.pdf", b"%PDF-1.4 aadhaar content", "application/pdf")
    upload_sample_doc(client, headers, "pan_card", "pan.png", b"\x89PNG pan content", "image/png")
    upload_sample_doc(client, headers, "cancelled_cheque", "cheque.pdf", b"%PDF-1.4 cheque content", "application/pdf")

    res = client.post("/api/v1/applications", json=sample_valid_payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()["data"]
    doc_categories = [d["category"] for d in data["documents"]]
    assert "cancelled_cheque" in doc_categories
    assert "bank_passbook" not in doc_categories


def test_list_and_get_application_isolation(client, sample_valid_payload):
    """Test user can view their own application and cannot access others."""
    headers_user_a = get_auth_token_for_user(client, "usera@example.org", "Password123")
    headers_user_b = get_auth_token_for_user(client, "userb@example.org", "Password123")

    upload_mandatory_docs(client, headers_user_a)

    # User A creates application
    res_a = client.post("/api/v1/applications", json=sample_valid_payload, headers=headers_user_a)
    app_id_a = res_a.get_json()["data"]["id"]

    # User B lists applications -> should be empty
    list_b = client.get("/api/v1/applications", headers=headers_user_b)
    assert len(list_b.get_json()["data"]) == 0

    # User A lists applications -> sees 1 application
    list_a = client.get("/api/v1/applications", headers=headers_user_a)
    assert len(list_a.get_json()["data"]) == 1

    # User B attempts to view User A's application -> 403 Forbidden
    res_forbidden = client.get(f"/api/v1/applications/{app_id_a}", headers=headers_user_b)
    assert res_forbidden.status_code == 403


def test_document_upload_success_and_staged_retrieval(client):
    """Test successful document upload, disk storage, and staged retrieval."""
    headers = get_auth_token_for_user(client, "uploadtest@example.org", "Password123")
    res = upload_sample_doc(
        client, headers, "aadhaar_card", "my_aadhaar.pdf", b"%PDF-1.4 test valid content", "application/pdf"
    )
    assert res.status_code == 201
    doc_data = res.get_json()["data"]
    doc_id = doc_data["id"]
    assert doc_data["category"] == "aadhaar_card"
    assert doc_data["original_filename"] == "my_aadhaar.pdf"

    # Verify staged document list
    staged_res = client.get("/api/v1/applications/documents", headers=headers)
    assert staged_res.status_code == 200
    staged_list = staged_res.get_json()["data"]
    assert any(d["id"] == doc_id for d in staged_list)

    # Verify download works for authorized owner
    dl_res = client.get(f"/api/v1/applications/documents/{doc_id}", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.data == b"%PDF-1.4 test valid content"


def test_document_upload_empty_file_rejected(client):
    """Test 0-byte file upload is rejected with a validation error."""
    headers = get_auth_token_for_user(client, "emptyfile@example.org", "Password123")
    res = upload_sample_doc(
        client, headers, "aadhaar_card", "empty.pdf", b"", "application/pdf"
    )
    assert res.status_code == 400
    assert "cannot be empty" in res.get_json()["message"]


def test_document_upload_oversized_file_rejected(client):
    """Test upload exceeding 5MB limit is rejected."""
    headers = get_auth_token_for_user(client, "bigfile@example.org", "Password123")
    oversized_content = b"0" * (5 * 1024 * 1024 + 1024)
    res = upload_sample_doc(
        client, headers, "aadhaar_card", "big.pdf", oversized_content, "application/pdf"
    )
    assert res.status_code == 400
    assert "exceeds maximum allowed limit" in res.get_json()["message"]


def test_document_upload_unauthenticated_rejected(client):
    """Test unauthenticated document upload returns 401."""
    data = {
        "category": "aadhaar_card",
        "file": (io.BytesIO(b"%PDF-1.4 content"), "sample.pdf", "application/pdf"),
    }
    res = client.post("/api/v1/applications/documents/upload", data=data, content_type="multipart/form-data")
    assert res.status_code == 401


def test_document_unauthorized_download_rejected(client):
    """Test candidate cannot download another candidate's private document."""
    headers_owner = get_auth_token_for_user(client, "doc_owner@example.org", "Password123")
    headers_other = get_auth_token_for_user(client, "doc_other@example.org", "Password123")

    res = upload_sample_doc(
        client, headers_owner, "pan_card", "private_pan.pdf", b"%PDF-1.4 private pan", "application/pdf"
    )
    assert res.status_code == 201
    doc_id = res.get_json()["data"]["id"]

    # Other user attempts to download owner's document
    dl_other = client.get(f"/api/v1/applications/documents/{doc_id}", headers=headers_other)
    assert dl_other.status_code == 403


def test_document_upload_replacement_removes_old_file(client):
    """Test uploading a new document in the same category replaces the old one."""
    import os
    from app.modules.candidates.models import CandidateDocument

    headers = get_auth_token_for_user(client, "replace_doc@example.org", "Password123")
    res1 = upload_sample_doc(
        client, headers, "aadhaar_card", "version1.pdf", b"%PDF-1.4 version 1", "application/pdf"
    )
    assert res1.status_code == 201
    doc1_id = res1.get_json()["data"]["id"]

    res2 = upload_sample_doc(
        client, headers, "aadhaar_card", "version2.pdf", b"%PDF-1.4 version 2", "application/pdf"
    )
    assert res2.status_code == 201
    doc2_id = res2.get_json()["data"]["id"]
    assert doc1_id != doc2_id

    # Verify only version 2 is in staged documents
    staged = client.get("/api/v1/applications/documents", headers=headers).get_json()["data"]
    aadhaar_docs = [d for d in staged if d["category"] == "aadhaar_card"]
    assert len(aadhaar_docs) == 1
    assert aadhaar_docs[0]["id"] == doc2_id


def get_admin_auth_token(client, email="admin_role_mgr@example.org", password="Password123"):
    """Helper to register/login an approved user with admin role."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Admin",
            "last_name": "Manager",
        },
    )
    from app.modules.auth.models import User, Role
    from app.extensions import db
    u = User.query.filter_by(email=email).first()
    if u:
        u.approval_status = "APPROVED"
        admin_role = Role.query.filter_by(name="admin").first()
        if admin_role and admin_role not in u.roles:
            u.roles.append(admin_role)
        db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_get_roles_public_and_active_only(client):
    """Test retrieving candidate roles returns the active roles."""
    res = client.get("/api/v1/applications/roles")
    assert res.status_code == 200
    roles = res.get_json()["data"]
    role_names = [r["name"] for r in roles]
    assert "HDD Operate" in role_names
    assert "HDD Tracker" in role_names
    assert "HDD Helper" in role_names
    # All returned roles must be active
    assert all(r["is_active"] is True for r in roles)


def test_admin_create_role_and_duplicate_check(client):
    """Test admin can create a new role and duplicates are rejected."""
    admin_headers = get_admin_auth_token(client, "admin_create@example.org")

    # Create new role
    payload = {
        "name": "HDD Senior Supervisor",
        "code": "HDD-SUP",
        "description": "Senior supervisor for HDD directional drilling works",
    }
    res = client.post("/api/v1/applications/roles", json=payload, headers=admin_headers)
    assert res.status_code == 201
    created_role = res.get_json()["data"]
    assert created_role["name"] == "HDD Senior Supervisor"
    assert created_role["code"] == "HDD-SUP"
    assert created_role["is_active"] is True

    # Try duplicate creation
    res_dup = client.post("/api/v1/applications/roles", json=payload, headers=admin_headers)
    assert res_dup.status_code == 409
    assert "already exists" in res_dup.get_json()["message"]


def test_admin_update_and_toggle_role(client):
    """Test admin can update role details and toggle active/inactive status."""
    admin_headers = get_admin_auth_token(client, "admin_toggle@example.org")

    # Create a role
    create_res = client.post(
        "/api/v1/applications/roles",
        json={"name": "HDD Safety Lead", "code": "HDD-SAF", "description": "Safety officer"},
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    role_id = create_res.get_json()["data"]["id"]

    # Update description
    update_res = client.put(
        f"/api/v1/applications/roles/{role_id}",
        json={"description": "Updated safety lead role description"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.get_json()["data"]["description"] == "Updated safety lead role description"

    # Toggle active -> deactivated
    toggle_res = client.post(
        f"/api/v1/applications/roles/{role_id}/toggle-active",
        headers=admin_headers,
    )
    assert toggle_res.status_code == 200
    assert toggle_res.get_json()["data"]["is_active"] is False

    # Candidate view should NOT include deactivated role
    public_roles = client.get("/api/v1/applications/roles").get_json()["data"]
    assert not any(r["name"] == "HDD Safety Lead" for r in public_roles)

    # Admin view with ?all=true DOES include deactivated role
    admin_roles = client.get("/api/v1/applications/roles?all=true", headers=admin_headers).get_json()["data"]
    safety_lead = next((r for r in admin_roles if r["id"] == role_id), None)
    assert safety_lead is not None
    assert safety_lead["is_active"] is False


def test_non_admin_cannot_manage_roles(client):
    """Test regular users cannot create, edit, or toggle roles."""
    user_headers = get_auth_token_for_user(client, "regular_user@example.org", "Password123")

    # Attempt create
    res1 = client.post(
        "/api/v1/applications/roles",
        json={"name": "Hacker Role"},
        headers=user_headers,
    )
    assert res1.status_code == 403

    # Attempt toggle on existing role
    roles = client.get("/api/v1/applications/roles").get_json()["data"]
    first_role_id = roles[0]["id"]

    res2 = client.post(
        f"/api/v1/applications/roles/{first_role_id}/toggle-active",
        headers=user_headers,
    )
    assert res2.status_code == 403

    # Attempt update
    res3 = client.put(
        f"/api/v1/applications/roles/{first_role_id}",
        json={"name": "Renamed By Non-Admin"},
        headers=user_headers,
    )
    assert res3.status_code == 403


def test_application_submission_with_dynamic_and_deactivated_role(client, sample_valid_payload):
    """Test candidate can apply with a newly created role, but deactivated role is rejected."""
    admin_headers = get_admin_auth_token(client, "admin_dynamic_app@example.org")

    # Admin creates new active role
    client.post(
        "/api/v1/applications/roles",
        json={"name": "Survey Specialist", "code": "SURV-01"},
        headers=admin_headers,
    )

    candidate_headers = get_auth_token_for_user(client, "surveyor@example.org", "Password123")
    upload_mandatory_docs(client, candidate_headers)

    # Candidate applies with "Survey Specialist"
    payload = dict(sample_valid_payload)
    payload["role_applied"] = "Survey Specialist"
    payload["email"] = "surveyor@example.org"

    app_res = client.post("/api/v1/applications", json=payload, headers=candidate_headers)
    assert app_res.status_code == 201
    assert app_res.get_json()["data"]["role_applied"] == "Survey Specialist"

    # Now admin deactivates "Survey Specialist"
    all_roles = client.get("/api/v1/applications/roles?all=true", headers=admin_headers).get_json()["data"]
    survey_role = next(r for r in all_roles if r["name"] == "Survey Specialist")
    client.post(f"/api/v1/applications/roles/{survey_role['id']}/toggle-active", headers=admin_headers)

    # Another candidate attempts to apply with the now-deactivated role
    cand2_headers = get_auth_token_for_user(client, "surveyor2@example.org", "Password123")
    upload_mandatory_docs(client, cand2_headers)

    payload2 = dict(sample_valid_payload)
    payload2["role_applied"] = "Survey Specialist"
    payload2["email"] = "surveyor2@example.org"

    app_res2 = client.post("/api/v1/applications", json=payload2, headers=cand2_headers)
    assert app_res2.status_code == 400
    assert "deactivated" in str(app_res2.get_json())



