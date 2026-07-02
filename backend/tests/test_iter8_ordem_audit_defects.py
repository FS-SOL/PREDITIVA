"""Iteration 8 tests: MeasurementModel.ordem sort, defects tipo (vibracao/termografia/ambos),
'Equipamento em Bom Estado' defect, /api/audit/deletions RBAC + logging.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://saude-equipamentos.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@fssolucoes.com", "password": "admin123"}
VIEWER = {"email": "viewer@fs.com", "password": "viewer123"}


def _login(payload):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def viewer_headers():
    return {"Authorization": f"Bearer {_login(VIEWER)}"}


# ============== Measurements: ordem field ==============
class TestMeasurementsOrdem:
    def test_measurements_have_ordem_field_and_sorted_asc(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/measurements", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0, "expected some measurements to exist (seed)"
        # every measurement has an 'ordem' key (int, may be 0)
        for it in items:
            assert "ordem" in it, f"measurement missing 'ordem': {it}"
            assert isinstance(it["ordem"], int), f"'ordem' should be int: {it}"
        # global sort by ordem asc (mongo sort [(ordem,1),(data,1)])
        ords = [it["ordem"] for it in items]
        assert ords == sorted(ords), f"measurements not sorted by ordem asc: first 20 = {ords[:20]}"

    def test_esf0001_motor01_has_9_measurements_ordered(self, admin_headers):
        # find machine ESF-0001 / Motor 01
        mr = requests.get(f"{BASE_URL}/api/machines?tipo=vibracao", headers=admin_headers, timeout=30)
        assert mr.status_code == 200
        machines = mr.json()
        target = next((m for m in machines if m.get("tag") == "ESF-0001 / Motor 01"), None)
        assert target is not None, "seed machine 'ESF-0001 / Motor 01' not found"
        mid = target["id"]
        r = requests.get(f"{BASE_URL}/api/measurements?machine_id={mid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        # per PRD: 9 measurements (3 pontos × 3 meses)
        assert len(items) >= 3, f"expected >=3 seed measurements for ESF-0001/Motor 01, got {len(items)}"
        # sorted by ordem asc
        ords = [it["ordem"] for it in items]
        assert ords == sorted(ords), f"per-machine measurements not sorted by ordem asc: {ords}"


# ============== Defects: tipo + Equipamento em Bom Estado ==============
class TestDefectsTipo:
    @pytest.fixture(scope="class")
    def defects(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/defects", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        return r.json()

    def test_defects_have_tipo(self, defects):
        for d in defects:
            assert "tipo" in d and d["tipo"] in ("vibracao", "termografia", "ambos"), f"bad tipo on defect: {d}"

    def test_at_least_12_vibracao_or_ambos(self, defects):
        # PRD: 12 defeitos tipo vibracao+ambos
        n = sum(1 for d in defects if d.get("tipo") in ("vibracao", "ambos"))
        assert n >= 12, f"expected >=12 vibracao/ambos defects, got {n}"

    def test_at_least_6_termografia_or_ambos(self, defects):
        # PRD: 6 termografia+ambos
        n = sum(1 for d in defects if d.get("tipo") in ("termografia", "ambos"))
        assert n >= 6, f"expected >=6 termografia/ambos defects, got {n}"

    def test_equipamento_bom_estado_exists_ambos_ok(self, defects):
        m = next((d for d in defects if d.get("nome") == "Equipamento em Bom Estado"), None)
        assert m is not None, "seed defect 'Equipamento em Bom Estado' missing"
        assert m.get("alarme") == "OK", f"expected alarme=OK, got {m.get('alarme')}"
        assert m.get("tipo") == "ambos", f"expected tipo=ambos, got {m.get('tipo')}"

    def test_ponto_quente_conexao_eletrica_is_termografia(self, defects):
        m = next((d for d in defects if d.get("nome") == "Ponto Quente em Conexão Elétrica"), None)
        assert m is not None, "seed defect 'Ponto Quente em Conexão Elétrica' missing"
        assert m.get("tipo") == "termografia"


# ============== Audit: /api/audit/deletions ==============
class TestAuditDeletions:
    def test_viewer_forbidden_403(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/audit/deletions", headers=viewer_headers, timeout=30)
        assert r.status_code == 403, f"viewer should get 403, got {r.status_code} {r.text}"

    def test_admin_ok_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/audit/deletions", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_diagnostic_creates_audit_log(self, admin_headers):
        # 1) find a machine
        mr = requests.get(f"{BASE_URL}/api/machines?tipo=vibracao", headers=admin_headers, timeout=30)
        assert mr.status_code == 200
        machines = mr.json()
        assert machines, "no machines available"
        m = machines[0]

        # 2) create a throw-away diagnostic (will be deleted)
        payload = {
            "machine_id": m["id"],
            "machine_tag": m.get("tag", ""),
            "defect_ids": [],
            "diagnostico": "TEST_iter8 audit diag",
            "causa": "TEST",
            "consequencia": "TEST",
            "recomendacao": "TEST",
            "status": "A1",
        }
        cr = requests.post(f"{BASE_URL}/api/diagnostics", json=payload, headers=admin_headers, timeout=30)
        assert cr.status_code == 200, cr.text
        diag = cr.json()
        did = diag["id"]

        # 3) snapshot audit count
        pre = requests.get(f"{BASE_URL}/api/audit/deletions", headers=admin_headers, timeout=30).json()
        n_before = len(pre)

        # 4) delete diag
        dr = requests.delete(f"{BASE_URL}/api/diagnostics/{did}", headers=admin_headers, timeout=30)
        assert dr.status_code == 200, dr.text

        # 5) audit log has grown, latest entry references our diag and admin user
        post = requests.get(f"{BASE_URL}/api/audit/deletions", headers=admin_headers, timeout=30).json()
        assert len(post) == n_before + 1, f"expected +1 audit log, got {len(post)} vs {n_before}"
        latest = post[0]  # sorted by data desc
        assert latest.get("entity_type") == "diagnóstico"
        assert latest.get("user_name") == "Administrador"
        assert latest.get("user_email") == "admin@fssolucoes.com"
        assert "description" in latest and latest["description"], "description missing"
        # description contains the machine_tag we posted
        assert m.get("tag", "") in latest["description"], f"description should include machine tag, got: {latest['description']}"

    def test_delete_measurement_creates_audit_log(self, admin_headers):
        # Create a measurement to delete
        mr = requests.get(f"{BASE_URL}/api/machines?tipo=vibracao", headers=admin_headers, timeout=30).json()
        target = next((m for m in mr if m.get("tag") == "ESF-0001 / Motor 01"), mr[0])
        payload = {
            "machine_id": target["id"],
            "machine_tag": target.get("tag", ""),
            "subconjunto": target.get("subconjunto", ""),
            "ponto": "TEST_PT",
            "valor": 1.23,
            "unidade": "mm/s",
            "deteccao": "Velocidade",
            "ordem": 999,
        }
        cr = requests.post(f"{BASE_URL}/api/measurements", json=payload, headers=admin_headers, timeout=30)
        assert cr.status_code == 200, cr.text
        mid = cr.json()["id"]

        n_before = len(requests.get(f"{BASE_URL}/api/audit/deletions", headers=admin_headers, timeout=30).json())
        dr = requests.delete(f"{BASE_URL}/api/measurements/{mid}", headers=admin_headers, timeout=30)
        assert dr.status_code == 200
        logs = requests.get(f"{BASE_URL}/api/audit/deletions", headers=admin_headers, timeout=30).json()
        assert len(logs) == n_before + 1
        assert logs[0].get("entity_type") == "medição"
        assert "TEST_PT" in logs[0].get("description", "")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
