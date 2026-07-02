"""Iteration 12 — Backend tests for /api/manual and /api/manual/pdf (admin-only)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://saude-equipamentos.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

ADMIN = {"email": "admin@fssolucoes.com", "password": "admin123"}
VIEWER = {"email": "viewer@fs.com", "password": "viewer123", "name": "Viewer Test", "role": "visualizador"}


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": creds["email"], "password": creds["password"]}, timeout=30)
    return r


def _ensure_viewer():
    """Idempotently guarantee viewer@fs.com exists with role=visualizador."""
    s = requests.Session()
    r = _login(s, VIEWER)
    if r.status_code == 200 and r.json().get("role") == "visualizador":
        return s.headers.get("Authorization"), r.json().get("token")
    # Register (may 400 if already exists)
    rr = requests.post(f"{BASE_URL}/api/auth/register", json=VIEWER, timeout=30)
    if rr.status_code not in (200, 400):
        pytest.skip(f"Cannot register viewer: {rr.status_code} {rr.text[:200]}")
    r2 = _login(s, VIEWER)
    if r2.status_code != 200:
        pytest.skip(f"Viewer login failed: {r2.status_code} {r2.text[:200]}")
    return None, r2.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def viewer_token():
    _, tok = _ensure_viewer()
    return tok


# ---------- Manual markdown ----------
class TestManualMarkdown:
    def test_admin_get_manual_returns_markdown(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/manual",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "markdown" in data
        md = data["markdown"]
        assert isinstance(md, str)
        assert len(md) > 5000, f"expected markdown >5000 chars, got {len(md)}"
        # basic sanity: markdown should contain a heading
        assert "#" in md

    def test_viewer_get_manual_403(self, viewer_token):
        r = requests.get(
            f"{BASE_URL}/api/manual",
            headers={"Authorization": f"Bearer {viewer_token}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/manual", timeout=30)
        assert r.status_code == 401


# ---------- Manual PDF ----------
class TestManualPdf:
    def test_admin_get_manual_pdf(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/manual/pdf",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf"), r.headers
        assert r.content[:4] == b"%PDF", f"expected %PDF header, got {r.content[:10]!r}"
        # Reasonable PDF size (should be several KB)
        assert len(r.content) > 5000, f"pdf too small: {len(r.content)} bytes"

    def test_viewer_get_manual_pdf_403(self, viewer_token):
        r = requests.get(
            f"{BASE_URL}/api/manual/pdf",
            headers={"Authorization": f"Bearer {viewer_token}"},
            timeout=60,
        )
        assert r.status_code == 403


# ---------- Regression: role-based endpoints still gate as expected ----------
class TestRoleGating:
    def test_audit_deletions_admin_only(self, admin_token, viewer_token):
        r_admin = requests.get(
            f"{BASE_URL}/api/audit/deletions",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r_admin.status_code == 200
        r_viewer = requests.get(
            f"{BASE_URL}/api/audit/deletions",
            headers={"Authorization": f"Bearer {viewer_token}"},
            timeout=30,
        )
        assert r_viewer.status_code == 403
