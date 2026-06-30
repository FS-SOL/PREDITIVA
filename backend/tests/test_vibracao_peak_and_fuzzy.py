"""
Iteration 7 — test the two backend slices:
  1. Vibracao peak / measurement persistence on 'ESF-0001 / Motor 01' (1HV=6.36, 1HA=0.85, 2HV=9.2)
  2. POST /api/measurements/import fuzzy 'contains' matching for subconjunto when no exact match
     -> 'MOTOR' (generic) must bind to an existing composite machine ('ESF-0001 / Motor 01'),
        NOT create a stub with raw tag 'ESF-0001'.
"""
import io
import os
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saude-equipamentos.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@fssolucoes.com", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- existing seed validation -------------------------------------------------
def test_esf0001_motor01_has_three_real_measurements(auth):
    r = requests.get(f"{BASE_URL}/api/measurements", headers=auth, timeout=30)
    assert r.status_code == 200
    rows = [m for m in r.json() if m.get("machine_tag") == "ESF-0001 / Motor 01"]
    points = {m["ponto"]: m for m in rows}
    assert {"1HV", "1HA", "2HV"}.issubset(points.keys()), f"missing points, got {list(points)}"
    assert points["1HV"]["valor"] == pytest.approx(6.36)
    assert points["1HA"]["valor"] == pytest.approx(0.85)
    assert points["2HV"]["valor"] == pytest.approx(9.2)
    # all machine_tag must be composite (contain '/'), never raw 'ESF-0001'
    for m in rows:
        assert "/" in m["machine_tag"], f"raw stub tag leaked: {m['machine_tag']}"


def test_peak_is_2hv_92(auth):
    """The card's peak in the UI is computed client-side from /measurements.
    Backend assertion: among ESF-0001 / Motor 01 latest values, 2HV=9.2 is the max."""
    r = requests.get(f"{BASE_URL}/api/measurements", headers=auth, timeout=30)
    rows = [m for m in r.json() if m.get("machine_tag") == "ESF-0001 / Motor 01"]
    peak = max(rows, key=lambda m: m["valor"])
    assert peak["ponto"] == "2HV"
    assert peak["valor"] == pytest.approx(9.2)
    assert peak["unidade"] == "mm/s"


def test_no_raw_esf_stub_machine_exists(auth):
    """Ensure no stub vibracao machine with raw tag 'ESF-0001' (or 'ESF-0002') exists."""
    r = requests.get(f"{BASE_URL}/api/machines?tipo=vibracao", headers=auth, timeout=30)
    assert r.status_code == 200
    raw_stubs = [m for m in r.json() if m.get("tag") in ("ESF-0001", "ESF-0002")]
    assert raw_stubs == [], f"raw-tag stubs still present: {raw_stubs}"


# --- fuzzy 'contém' import ----------------------------------------------------
def _build_xlsx(rows):
    wb = Workbook()
    ws = wb.active
    ws.append(["Equipamento", "Subconjunto", "Ponto", "Unidade", "Detecção", "Valor"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def test_fuzzy_subconjunto_contains_matches_existing_composite(auth):
    """Subconjunto='MOTOR' (uppercase generic) for Equipamento='ESF-0001' must bind to a real
    composite machine ('ESF-0001 / Motor 0X') via the 'contém' regex branch, not create a stub
    with raw tag 'ESF-0001'."""
    xlsx = _build_xlsx([["ESF-0001", "MOTOR", "3HV", "mm/s", "RMS", 2.0]])
    files = {"file": ("fuzzy_test.xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = requests.post(f"{BASE_URL}/api/measurements/import", headers=auth, files=files, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("inserted", 0) == 1, body

    # Verify the new 3HV measurement was attached to a composite tag
    r2 = requests.get(f"{BASE_URL}/api/measurements", headers=auth, timeout=30)
    assert r2.status_code == 200
    new_rows = [m for m in r2.json() if m.get("ponto") == "3HV" and "ESF-0001" in (m.get("machine_tag") or "")]
    assert new_rows, "3HV measurement not found after import"
    for m in new_rows:
        tag = m["machine_tag"]
        assert "/" in tag, f"fuzzy match failed — created stub with raw tag: {tag}"
        assert tag.lower().startswith("esf-0001 /"), tag
        assert "motor" in tag.lower(), f"didn't bind to a Motor* subconjunto: {tag}"

    # Verify no stub created
    r3 = requests.get(f"{BASE_URL}/api/machines?tipo=vibracao", headers=auth, timeout=30)
    stubs = [m for m in r3.json() if m.get("tag") == "ESF-0001"]
    assert stubs == [], f"stub created despite fuzzy match: {stubs}"


def test_cleanup_fuzzy_3hv_measurement(auth):
    """Remove the 3HV row created in the previous test (cleanup contract)."""
    r = requests.get(f"{BASE_URL}/api/measurements", headers=auth, timeout=30)
    assert r.status_code == 200
    to_del = [m for m in r.json() if m.get("ponto") == "3HV" and "ESF-0001" in (m.get("machine_tag") or "")]
    for m in to_del:
        dr = requests.delete(f"{BASE_URL}/api/measurements/{m['id']}", headers=auth, timeout=15)
        assert dr.status_code in (200, 204), dr.text
    # confirm gone
    r2 = requests.get(f"{BASE_URL}/api/measurements", headers=auth, timeout=30)
    leftover = [m for m in r2.json() if m.get("ponto") == "3HV" and "ESF-0001" in (m.get("machine_tag") or "")]
    assert leftover == []
