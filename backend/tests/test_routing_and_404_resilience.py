import pytest
from app.extensions import db
from app.modules.auth.models import User


def test_health_check_endpoints_all_accessible(client):
    """Verify /health, /api/health, and /api/v1/health all return healthy status."""
    for url in ["/health", "/api/health", "/api/v1/health"]:
        res = client.get(url)
        assert res.status_code == 200, f"Failed on {url}"
        data = res.get_json()
        assert data["status"] == "healthy"
        assert data["service"] == "candidate-enrollment-portal-api"


def test_strict_slashes_disabled_no_404_on_trailing_slash(client):
    """Verify that trailing slashes on endpoints do not trigger 404 NOT_FOUND."""
    # Auth register with trailing slash (without body -> 400 validation error, NOT 404!)
    res_slash = client.post("/api/v1/auth/register/", json={})
    assert res_slash.status_code != 404

    # Candidate applications with trailing slash
    res_apps_slash = client.get("/api/v1/applications/")
    # Returns 401 Unauthorized because endpoint requires auth, NOT 404!
    assert res_apps_slash.status_code == 401


def test_candidates_legacy_alias_blueprint(client):
    """Verify that /api/v1/candidates and /api/v1/applications both route to the candidates module."""
    # Both require authentication and return 401, not 404
    res_primary = client.get("/api/v1/applications")
    assert res_primary.status_code == 401

    res_alias = client.get("/api/v1/candidates")
    assert res_alias.status_code == 401


def test_root_and_api_root_endpoints(client):
    """Verify /, /api, /api/, /api/v1, /api/v1/ return 200 OK and not 404 NOT_FOUND."""
    for url in ["/", "/api", "/api/", "/api/v1", "/api/v1/"]:
        res = client.get(url)
        assert res.status_code == 200, f"Failed on {url}"
        if res.is_json:
            data = res.get_json()
            assert data.get("status") == "healthy" or data.get("service") == "candidate-enrollment-portal-api"


def test_document_download_alias_routes(client):
    """Verify document download route aliases (/documents/<id> and /documents/<id>/download)."""
    import uuid
    dummy_uuid = str(uuid.uuid4())
    # Both endpoints should reach the handler and return 401 Unauthorized (because of @require_auth), NOT 404!
    for url in [
        f"/api/v1/applications/documents/{dummy_uuid}",
        f"/api/v1/applications/documents/{dummy_uuid}/download",
        f"/api/v1/candidates/documents/{dummy_uuid}",
        f"/api/v1/candidates/documents/{dummy_uuid}/download",
    ]:
        res = client.get(url)
        assert res.status_code == 401, f"Expected 401 on {url}, got {res.status_code}"


def test_letters_candidate_alias_routes(client):
    """Verify candidate letters endpoints work with both /applications/ and /candidates/ prefixes."""
    import uuid
    dummy_id = str(uuid.uuid4())
    # Require authentication -> returns 401, proving route exists and is not 404
    for url in [
        f"/api/v1/applications/{dummy_id}/letters",
        f"/api/v1/candidates/{dummy_id}/letters",
        f"/api/v1/applications/{dummy_id}/letters/letter_of_intent/download",
        f"/api/v1/candidates/{dummy_id}/letters/letter_of_intent/download",
        "/api/v1/letters/templates/letter_of_intent/download",
        "/api/v1/templates/letter_of_intent/download",
    ]:
        res = client.get(url)
        assert res.status_code == 401, f"Expected 401 on {url}, got {res.status_code}"


def test_genuinely_unknown_api_route_returns_structured_404(client):
    """Verify that genuinely nonexistent API routes return structured 404 JSON."""
    res = client.get("/api/v1/unknown-endpoint-xyz-123")
    assert res.status_code == 404
    data = res.get_json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"
    assert "The requested URL was not found on the server" in data["message"]

