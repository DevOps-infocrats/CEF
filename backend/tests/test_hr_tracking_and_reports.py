import io
import uuid
import zoneinfo
from datetime import datetime, timezone, timedelta
import openpyxl
import pytest
from app.extensions import db
from app.modules.auth.models import User, Role, UserRole
from app.modules.auth.services import hash_password
from app.modules.candidates.models import CandidateApplication
from app.modules.candidates.services import REPORT_TIMEZONE


def create_user(email: str, password: str, first_name: str, last_name: str, role_name: str = "reviewer") -> User:
    """Helper to create and activate a test user with assigned role."""
    user = User(
        email=email,
        username=email.split("@")[0],
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_verified=True,
        approval_status="APPROVED",
    )
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        role = Role(name=role_name, description=f"{role_name} role")
        db.session.add(role)
        db.session.flush()

    db.session.add(user)
    db.session.flush()
    ur = UserRole(user_id=user.id, role_id=role.id)
    db.session.add(ur)
    db.session.commit()
    return user


def login(client, email: str, password: str) -> dict:
    """Helper to login and get Authorization bearer header."""
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.json}"
    token = res.json["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_hr_tracking_creator_assignment_and_preservation(client, app):
    """Test HR User A and B creation, creator name display, and preservation on edit."""
    with app.app_context():
        user_a = create_user("hr_a@example.com", "Pass@1234", "Priya", "Sharma", "admin")
        user_b = create_user("hr_b@example.com", "Pass@1234", "Vikram", "Malhotra", "admin")
        user_a_id = user_a.id
        user_b_id = user_b.id

    client_a = app.test_client()
    client_b = app.test_client()
    headers_a = login(client_a, "hr_a@example.com", "Pass@1234")
    headers_b = login(client_b, "hr_b@example.com", "Pass@1234")

    # 1. HR User A creates Candidate A
    cand_payload_a = {
        "hero_category": "Hero 1",
        "role_applied": "HDD Operate",
        "full_name": "Rohan Verma",
        "mobile_number": "9876543210",
        "email": "rohan.v@example.com",
    }
    res_a = client_a.post("/api/v1/applications", json=cand_payload_a, headers=headers_a)
    assert res_a.status_code == 201
    app_a_id = res_a.json["data"]["id"]
    assert res_a.json["data"]["created_by_name"] == "Priya Sharma"

    # Verify directly in DB
    with app.app_context():
        db_app_a = db.session.get(CandidateApplication, uuid.UUID(app_a_id))
        assert db_app_a.created_by_id == user_a_id

    # 2. HR User B creates Candidate B
    cand_payload_b = {
        "hero_category": "Hero 2",
        "role_applied": "HDD Tracker",
        "full_name": "Meera Joshi",
        "mobile_number": "9123456780",
        "email": "meera.j@example.com",
    }
    res_b = client_b.post("/api/v1/applications", json=cand_payload_b, headers=headers_b)
    assert res_b.status_code == 201
    app_b_id = res_b.json["data"]["id"]
    assert res_b.json["data"]["created_by_name"] == "Vikram Malhotra"

    # Verify directly in DB
    with app.app_context():
        db_app_b = db.session.get(CandidateApplication, uuid.UUID(app_b_id))
        assert db_app_b.created_by_id == user_b_id

    # 3. HR User B edits Candidate A's details
    edit_payload = {
        "full_name": "Rohan Verma Updated",
        "role_applied": "HDD Operate",
    }
    edit_res = client_b.put(f"/api/v1/applications/{app_a_id}", json=edit_payload, headers=headers_b)
    assert edit_res.status_code == 200
    assert edit_res.json["data"]["full_name"] == "Rohan Verma Updated"
    # Creator must remain User A!
    assert edit_res.json["data"]["created_by_name"] == "Priya Sharma"

    with app.app_context():
        db_app_a_reloaded = db.session.get(CandidateApplication, uuid.UUID(app_a_id))
        assert db_app_a_reloaded.created_by_id == user_a_id


def test_legacy_record_without_creator_handled_safely(client, app):
    """Test that existing records with created_by_id=None return None safely without fake names."""
    with app.app_context():
        user = create_user("hr_viewer@example.com", "Pass@1234", "Viewer", "Admin", "reviewer")
        # Create legacy application with created_by_id = None
        legacy_app = CandidateApplication(
            application_number="CEF-APP-LEGACY-001",
            user_id=user.id,
            created_by_id=None,
            hero_category="Hero 1",
            role_applied="HDD Helper",
            full_name="Legacy Candidate",
            status="PENDING_VERIFICATION",
        )
        db.session.add(legacy_app)
        db.session.commit()
        legacy_id = str(legacy_app.id)

    headers = login(client, "hr_viewer@example.com", "Pass@1234")
    res = client.get(f"/api/v1/applications/{legacy_id}", headers=headers)
    assert res.status_code == 200
    assert res.json["data"]["created_by_id"] is None
    assert res.json["data"]["created_by_name"] is None


def test_filters_candidate_name_hr_name_and_date_range(client, app):
    """Test filtering applications by candidate name, HR creator name, date range, and combined."""
    with app.app_context():
        hr_priya = create_user("priya_filter@example.com", "Pass@1234", "Priya", "Patel", "reviewer")
        hr_rahul = create_user("rahul_filter@example.com", "Pass@1234", "Rahul", "Dravid", "reviewer")

        # Candidate 1: created by Priya on today
        app1 = CandidateApplication(
            application_number="CEF-APP-FILT-001",
            user_id=hr_priya.id,
            created_by_id=hr_priya.id,
            hero_category="Hero 1",
            role_applied="HDD Operate",
            full_name="Aarav Sharma",
            status="SUBMITTED",
        )
        # Candidate 2: created by Rahul on today
        app2 = CandidateApplication(
            application_number="CEF-APP-FILT-002",
            user_id=hr_rahul.id,
            created_by_id=hr_rahul.id,
            hero_category="Hero 1",
            role_applied="HDD Tracker",
            full_name="Bhavna Gupta",
            status="APPROVED",
        )
        # Candidate 3: created by Priya 5 days ago
        five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)
        app3 = CandidateApplication(
            application_number="CEF-APP-FILT-003",
            user_id=hr_priya.id,
            created_by_id=hr_priya.id,
            hero_category="Hero 2",
            role_applied="HDD Helper",
            full_name="Chirag Saxena",
            status="SUBMITTED",
        )
        app3.created_at = five_days_ago

        db.session.add_all([app1, app2, app3])
        db.session.commit()

    headers = login(client, "priya_filter@example.com", "Pass@1234")

    # 1. Filter by Candidate Name
    res = client.get("/api/v1/applications?candidate_name=Aarav", headers=headers)
    assert res.status_code == 200
    names = [a["full_name"] for a in res.json["data"]]
    assert "Aarav Sharma" in names
    assert "Bhavna Gupta" not in names
    assert "Chirag Saxena" not in names

    # 2. Filter by HR Name ("Rahul")
    res_hr = client.get("/api/v1/applications?hr_name=Rahul", headers=headers)
    assert res_hr.status_code == 200
    apps_hr = res_hr.json["data"]
    assert len(apps_hr) == 1
    assert apps_hr[0]["full_name"] == "Bhavna Gupta"
    assert apps_hr[0]["created_by_name"] == "Rahul Dravid"

    # 3. Filter by Date Range (Start Date and End Date covering today only)
    today_str = datetime.now(REPORT_TIMEZONE).strftime("%Y-%m-%d")
    res_today = client.get(f"/api/v1/applications?start_date={today_str}&end_date={today_str}", headers=headers)
    assert res_today.status_code == 200
    apps_today = res_today.json["data"]
    today_names = [a["full_name"] for a in apps_today]
    assert "Aarav Sharma" in today_names
    assert "Bhavna Gupta" in today_names
    assert "Chirag Saxena" not in today_names  # 5 days ago excluded

    # 4. Combined Filter: HR "Priya" AND Date Range (last 7 days to 2 days ago)
    start_7 = (datetime.now(REPORT_TIMEZONE) - timedelta(days=7)).strftime("%Y-%m-%d")
    end_2 = (datetime.now(REPORT_TIMEZONE) - timedelta(days=2)).strftime("%Y-%m-%d")
    res_comb = client.get(
        f"/api/v1/applications?hr_name=Priya&start_date={start_7}&end_date={end_2}",
        headers=headers,
    )
    assert res_comb.status_code == 200
    comb_apps = res_comb.json["data"]
    assert len(comb_apps) == 1
    assert comb_apps[0]["full_name"] == "Chirag Saxena"

    # 5. Clear Filters: calling without query params returns all records
    res_all = client.get("/api/v1/applications", headers=headers)
    assert res_all.status_code == 200
    all_names = [a["full_name"] for a in res_all.json["data"]]
    assert "Aarav Sharma" in all_names
    assert "Bhavna Gupta" in all_names
    assert "Chirag Saxena" in all_names


def test_excel_export_format_content_and_security(client, app):
    """Test Download Excel Report functionality, columns, timestamps, timezone, and security."""
    with app.app_context():
        hr_user = create_user("export_hr@example.com", "Pass@1234", "Sunita", "Rao", "reviewer")
        cand_user = create_user("export_cand@example.com", "Pass@1234", "Deepak", "Chopra", "candidate")

        app_rec = CandidateApplication(
            application_number="CEF-APP-EXP-001",
            user_id=cand_user.id,
            created_by_id=hr_user.id,
            hero_category="Hero 1",
            role_applied="HDD Operate",
            full_name="Deepak Chopra",
            mobile_number="9888877777",
            email="deepak.c@example.com",
            aadhaar_number="123412341234",
            pan_number="ABCDE1234F",
            account_number="987654321098",
            status="APPROVED",
        )
        db.session.add(app_rec)
        db.session.commit()

    headers = login(client, "export_hr@example.com", "Pass@1234")

    # Download Excel Report
    res = client.get("/api/v1/applications/export?candidate_name=Deepak", headers=headers)
    assert res.status_code == 200
    assert res.content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Filename check
    disposition = res.headers.get("Content-Disposition", "")
    assert "CEF_Candidate_Report_" in disposition
    assert ".xlsx" in disposition

    # Parse Excel content with openpyxl
    excel_bytes = io.BytesIO(res.data)
    wb = openpyxl.load_workbook(excel_bytes)
    ws = wb.active
    assert ws.title == "Candidate Applications"

    # Verify Original 7 Headers are preserved in exact order
    expected_original_headers = [
        "Candidate Application ID",
        "Candidate Name",
        "HR / Creator Name",
        "Creation Date",
        "Creation Time",
        "Current Candidate Status",
        "Candidate Designation / Role",
    ]
    actual_headers = [cell.value for cell in ws[1]]
    assert actual_headers[:7] == expected_original_headers

    # Verify additional candidate detail headers
    expected_additional_headers = [
        "Hero Category",
        "Mobile Number",
        "Email Address",
        "Aadhaar Number",
        "PAN Number",
        "Current Address Line 1",
        "Bank Name",
        "Account Number",
        "Circle",
        "District",
        "Block",
        "Current Salary",
        "Uploaded Documents",
        "Document Verification Status",
    ]
    for h in expected_additional_headers:
        assert h in actual_headers

    # Verify Data Row
    rows = list(ws.iter_rows(values_only=True))
    assert len(rows) >= 2  # Header + at least 1 record
    data_row = rows[1]

    # Column 0: Application ID
    assert data_row[0] == "CEF-APP-EXP-001"
    # Column 1: Candidate Name
    assert data_row[1] == "Deepak Chopra"
    # Column 2: HR / Creator Name
    assert data_row[2] == "Sunita Rao"
    # Column 3 & 4: Creation Date & Creation Time (format check)
    assert len(str(data_row[3])) == 10  # YYYY-MM-DD
    assert len(str(data_row[4])) == 8   # HH:MM:SS
    # Column 5: Status
    assert data_row[5] == "APPROVED"
    # Column 6: Role
    assert data_row[6] == "HDD Operate"

    # Additional Columns check: verify candidate details populated
    header_indices = {header: idx for idx, header in enumerate(actual_headers)}
    assert data_row[header_indices["Mobile Number"]] == "9888877777"
    assert data_row[header_indices["Email Address"]] == "deepak.c@example.com"
    assert data_row[header_indices["Aadhaar Number"]] == "123412341234"
    assert data_row[header_indices["PAN Number"]] == "ABCDE1234F"
    assert data_row[header_indices["Account Number"]] == "987654321098"

    # SECURITY CHECK: Verify passwords, secret keys, or password hashes are NOT in the excel report
    all_cell_values = [str(val) for row in rows for val in row if val is not None]
    for forbidden_val in ["Pass@1234", "password_hash", "access_token"]:
        assert forbidden_val not in all_cell_values


def test_excel_export_permissions(client, app):
    """Test unauthenticated and unauthorized access control on excel export."""
    # 1. Unauthenticated -> 401
    res = client.get("/api/v1/applications/export")
    assert res.status_code == 401

    # 2. Creators list endpoint
    res_creators_unauth = client.get("/api/v1/applications/creators")
    assert res_creators_unauth.status_code == 401

    with app.app_context():
        create_user("hr_creators@example.com", "Pass@1234", "Anita", "Deshmukh", "reviewer")

    hr_headers = login(client, "hr_creators@example.com", "Pass@1234")
    res_creators = client.get("/api/v1/applications/creators", headers=hr_headers)
    assert res_creators.status_code == 200
    assert isinstance(res_creators.json["data"], list)
