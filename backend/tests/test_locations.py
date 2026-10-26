import io
import pytest
from app.modules.locations.importer import import_location_excel
from app.modules.locations.models import LocationState, LocationDistrict, LocationBlock
from tests.test_candidates import get_auth_token_for_user, get_admin_auth_token, upload_mandatory_docs

EXCEL_PATH = r"C:\Users\Mayank Office\Downloads\Rajasthan_Districts_and_Blocks.xlsx"


@pytest.fixture
def seeded_rajasthan(app):
    """Seed Rajasthan Location Master for tests."""
    with app.app_context():
        import os
        if os.path.exists(EXCEL_PATH):
            import_location_excel(EXCEL_PATH, state_name="Rajasthan", state_code="RJ")
        else:
            # Fallback manual seed for test environment if file path differed
            state = LocationState.query.filter_by(name="Rajasthan").first()
            if not state:
                state = LocationState(name="Rajasthan", code="RJ", is_active=True)
                from app.extensions import db
                db.session.add(state)
                db.session.commit()
                d1 = LocationDistrict(state_id=state.id, name="Ajmer", is_active=True)
                d2 = LocationDistrict(state_id=state.id, name="Alwar", is_active=True)
                db.session.add_all([d1, d2])
                db.session.commit()
                b1 = LocationBlock(district_id=d1.id, name="Ajmer Rural", is_active=True)
                b2 = LocationBlock(district_id=d1.id, name="Arain", is_active=True)
                b3 = LocationBlock(district_id=d2.id, name="Bansur", is_active=True)
                db.session.add_all([b1, b2, b3])
                db.session.commit()


def test_import_rajasthan_excel_and_idempotency(client, app):
    """Test importing Rajasthan Excel produces 41 districts and 296 blocks idempotently."""
    import os
    if not os.path.exists(EXCEL_PATH):
        pytest.skip("Excel file not found at path")

    with app.app_context():
        res1 = import_location_excel(EXCEL_PATH, state_name="Rajasthan", state_code="RJ")
        assert res1["state"] == "Rajasthan"
        assert res1["total_districts"] == 41
        assert res1["total_blocks"] == 296
        assert res1["invalid_records"] == 0

        # Repeated import -> 0 created, all skipped
        res2 = import_location_excel(EXCEL_PATH, state_name="Rajasthan", state_code="RJ")
        assert res2["created_districts"] == 0
        assert res2["skipped_districts"] == 41
        assert res2["created_blocks"] == 0
        assert res2["skipped_blocks"] == 296


def test_list_states_districts_blocks_endpoints(client, seeded_rajasthan):
    """Test public endpoints for retrieving states, districts, and mapped blocks."""
    # List states
    res_states = client.get("/api/v1/locations/states")
    assert res_states.status_code == 200
    states = res_states.get_json()["data"]
    rj_state = next((s for s in states if s["name"] == "Rajasthan"), None)
    assert rj_state is not None
    state_id = rj_state["id"]

    # List districts under Rajasthan
    res_districts = client.get(f"/api/v1/locations/states/{state_id}/districts")
    assert res_districts.status_code == 200
    districts = res_districts.get_json()["data"]
    assert len(districts) >= 2
    d_names = [d["name"] for d in districts]
    assert "Ajmer" in d_names

    ajmer_dist = next(d for d in districts if d["name"] == "Ajmer")

    # List blocks for Ajmer only
    res_blocks = client.get(f"/api/v1/locations/blocks?district_ids={ajmer_dist['id']}")
    assert res_blocks.status_code == 200
    blocks = res_blocks.get_json()["data"]
    assert len(blocks) > 0
    assert all(b["district_id"] == ajmer_dist["id"] for b in blocks)
    assert any(b["name"] == "Ajmer Rural" for b in blocks)


def test_admin_create_future_state_and_sub_entities(client):
    """Test admin can add a future state, district, and block."""
    admin_headers = get_admin_auth_token(client, "admin_loc@example.org")

    # 1. Create State: Gujarat
    res_state = client.post(
        "/api/v1/locations/states",
        json={"name": "Gujarat", "code": "GJ"},
        headers=admin_headers,
    )
    assert res_state.status_code == 201
    state_id = res_state.get_json()["data"]["id"]

    # 2. Create District: Ahmedabad
    res_dist = client.post(
        f"/api/v1/locations/states/{state_id}/districts",
        json={"name": "Ahmedabad", "code": "AHM"},
        headers=admin_headers,
    )
    assert res_dist.status_code == 201
    dist_id = res_dist.get_json()["data"]["id"]

    # 3. Create Block: Sanand
    res_block = client.post(
        f"/api/v1/locations/districts/{dist_id}/blocks",
        json={"name": "Sanand", "code": "SND"},
        headers=admin_headers,
    )
    assert res_block.status_code == 201
    assert res_block.get_json()["data"]["name"] == "Sanand"


def test_non_admin_cannot_modify_locations(client, seeded_rajasthan):
    """Test regular users cannot create states, districts, or import files."""
    user_headers = get_auth_token_for_user(client, "regular_loc@example.org", "Password123")

    # Attempt state create
    res1 = client.post(
        "/api/v1/locations/states",
        json={"name": "Unauthorized State"},
        headers=user_headers,
    )
    assert res1.status_code == 403

    # Attempt import
    data = {"file": (io.BytesIO(b"fake excel"), "test.xlsx")}
    res2 = client.post(
        "/api/v1/locations/import",
        data=data,
        content_type="multipart/form-data",
        headers=user_headers,
    )
    assert res2.status_code == 403


def test_application_submission_with_multi_select_districts_and_blocks(client, seeded_rajasthan, sample_valid_payload):
    """Test candidate application submission with multiple selected districts and blocks."""
    # Find Ajmer and Alwar IDs
    states_res = client.get("/api/v1/locations/states")
    rj = next(s for s in states_res.get_json()["data"] if s["name"] == "Rajasthan")
    dist_res = client.get(f"/api/v1/locations/states/{rj['id']}/districts")
    districts = dist_res.get_json()["data"]
    ajmer = next(d for d in districts if d["name"] == "Ajmer")
    alwar = next(d for d in districts if d["name"] == "Alwar")

    # Find blocks under Ajmer and Alwar
    blocks_res = client.get(f"/api/v1/locations/blocks?district_ids={ajmer['id']},{alwar['id']}")
    blocks = blocks_res.get_json()["data"]
    ajmer_blocks = [b for b in blocks if b["district_id"] == ajmer["id"]]
    alwar_blocks = [b for b in blocks if b["district_id"] == alwar["id"]]

    selected_dist_ids = [ajmer["id"], alwar["id"]]
    selected_block_ids = [ajmer_blocks[0]["id"], alwar_blocks[0]["id"]]

    candidate_headers = get_auth_token_for_user(client, "multi_loc@example.org", "Password123")
    upload_mandatory_docs(client, candidate_headers)

    payload = dict(sample_valid_payload)
    payload["circle"] = "Rajasthan"
    payload["district_ids"] = selected_dist_ids
    payload["block_ids"] = selected_block_ids
    payload["email"] = "multi_loc@example.org"

    res = client.post("/api/v1/applications", json=payload, headers=candidate_headers)
    assert res.status_code == 201
    data = res.get_json()["data"]

    # Verify relational data is dumped correctly
    assert len(data["selected_districts"]) == 2
    assert len(data["selected_blocks"]) == 2
    d_names = [d["name"] for d in data["selected_districts"]]
    assert "Ajmer" in d_names
    assert "Alwar" in d_names


def test_submission_rejected_when_block_does_not_belong_to_district(client, seeded_rajasthan, sample_valid_payload):
    """Test backend rejects submission if a block does not belong to any selected district."""
    states_res = client.get("/api/v1/locations/states")
    rj = next(s for s in states_res.get_json()["data"] if s["name"] == "Rajasthan")
    dist_res = client.get(f"/api/v1/locations/states/{rj['id']}/districts")
    districts = dist_res.get_json()["data"]
    ajmer = next(d for d in districts if d["name"] == "Ajmer")
    alwar = next(d for d in districts if d["name"] == "Alwar")

    # Get block from Alwar
    alwar_blocks = client.get(f"/api/v1/locations/blocks?district_ids={alwar['id']}").get_json()["data"]

    candidate_headers = get_auth_token_for_user(client, "mismatch@example.org", "Password123")
    upload_mandatory_docs(client, candidate_headers)

    # Candidate only selected Ajmer, but passes a block from Alwar
    payload = dict(sample_valid_payload)
    payload["circle"] = "Rajasthan"
    payload["district_ids"] = [ajmer["id"]]
    payload["block_ids"] = [alwar_blocks[0]["id"]]
    payload["email"] = "mismatch@example.org"

    res = client.post("/api/v1/applications", json=payload, headers=candidate_headers)
    assert res.status_code == 400
    assert "does not belong to any of the selected districts" in str(res.get_json())
