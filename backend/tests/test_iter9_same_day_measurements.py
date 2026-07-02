"""Iter9 backend regression: ESF-0001/Motor 01 must expose all 10 measurements
with 'ordem' field. In particular 1HV must have 4 rows (2 in the same day 15/06/2026)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saude-equipamentos.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@fssolucoes.com", "password": "admin123"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def esf_measurements(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/measurements",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return [m for m in data if m.get("machine_tag") == "ESF-0001 / Motor 01"]


def test_total_10_measurements(esf_measurements):
    assert len(esf_measurements) == 10, f"expected 10, got {len(esf_measurements)}"


def test_all_have_ordem_field(esf_measurements):
    for m in esf_measurements:
        assert "ordem" in m, f"missing ordem: {m}"


def test_1hv_has_4_readings_including_same_day(esf_measurements):
    onehv = [m for m in esf_measurements if m.get("ponto") == "1HV"]
    assert len(onehv) == 4, f"expected 4 1HV rows, got {len(onehv)}"
    dates = sorted([m["data"] for m in onehv])
    # 2 on 2026-06-15 (12:00 and 18:30)
    same_day = [d for d in dates if d.startswith("2026-06-15")]
    assert len(same_day) == 2, f"expected 2 rows on 2026-06-15, got {same_day}"
    values = {m["data"]: m["valor"] for m in onehv}
    # last (18:30) is 10.5
    assert any(v == 10.5 for v in values.values()), f"expected 10.5 present, got {values}"
    assert any(v == 9.2 for v in values.values()), f"expected 9.2 present, got {values}"
    assert any(v == 5.8 for v in values.values()), f"expected 5.8 present, got {values}"
    assert any(v == 3.1 for v in values.values()), f"expected 3.1 present, got {values}"


def test_1ha_and_2hv_counts(esf_measurements):
    oneha = [m for m in esf_measurements if m.get("ponto") == "1HA"]
    twohv = [m for m in esf_measurements if m.get("ponto") == "2HV"]
    assert len(oneha) == 3, f"expected 3 1HA rows, got {len(oneha)}"
    assert len(twohv) == 3, f"expected 3 2HV rows, got {len(twohv)}"


def test_1hv_latest_is_a2_alarm(esf_measurements):
    onehv = sorted(
        [m for m in esf_measurements if m.get("ponto") == "1HV"],
        key=lambda m: m.get("data", ""),
    )
    latest = onehv[-1]
    assert latest["valor"] == 10.5
    assert latest["alarme"] == "A2"
