import io
import uuid
import pytest
from app.extensions import db
from app.modules.auth.models import User
from app.modules.candidates.models import (
    CandidateApplication,
    CandidateApplicationDistrict,
    CandidateApplicationBlock,
)
from app.modules.candidates.schema_maintenance import ensure_candidate_schema


def get_token_for(client, email, password="Password123", role_name="Applicant"):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
        },
    )
    u = db.session.execute(db.select(User).filter_by(email=email)).scalar_one_or_none()
    if u:
        u.approval_status = "APPROVED"
        db.session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return {"Authorization": f"Bearer {login_res.get_json()['data']['access_token']}"}


def test_schema_maintenance_idempotency(app):
    """Verify that ensure_candidate_schema runs idempotently without error."""
    with app.app_context():
        ensure_candidate_schema(force=True)
        ensure_candidate_schema(force=False)
        ensure_candidate_schema(force=True)


def test_submission_with_duplicate_districts_and_blocks(client, clean_db):
    """
    Verify that duplicate district or block inputs (e.g. from user input summary or multi-select)
    are safely deduplicated and do not violate database unique constraints.
    """
    headers = get_token_for(client, "dedup_test@example.com")

    payload = {
        "full_name": "Dedup Candidate",
        "mobile_number": "9998887777",
        "district": "Patna, Patna, Gaya",
        "block": "Block A, Block A, Block B",
        "current_salary": "25000",
    }

    res = client.post("/api/v1/applications", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()["data"]
    app_id = data["id"]

    # Verify districts deduplicated
    districts = db.session.execute(
        db.select(CandidateApplicationDistrict).where(
            CandidateApplicationDistrict.application_id == uuid.UUID(app_id)
        )
    ).scalars().all()
    dist_names = [d.district_name for d in districts]
    assert len(dist_names) == 2
    assert set(dist_names) == {"Patna", "Gaya"}

    # Verify blocks deduplicated
    blocks = db.session.execute(
        db.select(CandidateApplicationBlock).where(
            CandidateApplicationBlock.application_id == uuid.UUID(app_id)
        )
    ).scalars().all()
    blk_names = [b.block_name for b in blocks]
    assert len(blk_names) == 2
    assert set(blk_names) == {"Block A", "Block B"}


def test_submission_with_missing_optional_fields_and_persistence(client, clean_db):
    """Verify candidate with optional fields omitted persists successfully and sets created_by_id."""
    headers = get_token_for(client, "partial_submit@example.com")

    # Submit with only mandatory/basic info, all other fields missing or null
    payload = {
        "full_name": "Incomplete Candidate",
        "mobile_number": "9123456789",
        "email": "incomplete@example.com",
    }

    res = client.post("/api/v1/applications", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["full_name"] == "Incomplete Candidate"
    assert data["mobile_number"] == "9123456789"
    assert data["aadhaar_number"] is None
    assert data["current_address_line1"] is None
    assert data["created_by_id"] is not None

    # Verify in DB
    app_record = db.session.get(CandidateApplication, uuid.UUID(data["id"]))
    assert app_record is not None
    assert app_record.full_name == "Incomplete Candidate"
    assert app_record.created_by_id is not None
