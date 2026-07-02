"""
Iteration 13 — Multi-tenant architecture tests.

Covers:
- Super-Admin login + /auth/me tenant_id null
- /api/tenants listing (superadmin only, includes counts)
- Cross-tenant data isolation for machines/dashboard/diagnostics/measurements/thermal
- Tenant-admin cannot be spoofed via X-Tenant-Id header
- POST /api/tenants creates tenant + admin, new tenant starts empty
- Global /api/defects shared across tenants
- Write requires tenant scope (400 when superadmin has no tenant selected)
- Regression: /api/auth/register scoped to tenant
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "admin@fssolucoes.com"
SUPER_PASS = "admin123"
SAUDALI_EMAIL = "admin@saudali.com"
DEMO_EMAIL = "admin@fsdemo.com"
TENANT_PASS = "demo123"


# ------- session helpers -------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data


def _hdr(token, tenant_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if tenant_id:
        h["X-Tenant-Id"] = tenant_id
    return h


# ------- fixtures -------
@pytest.fixture(scope="module")
def super_token():
    tok, _ = _login(SUPER_EMAIL, SUPER_PASS)
    return tok


@pytest.fixture(scope="module")
def saudali_admin_token():
    tok, _ = _login(SAUDALI_EMAIL, TENANT_PASS)
    return tok


@pytest.fixture(scope="module")
def demo_admin_token():
    tok, _ = _login(DEMO_EMAIL, TENANT_PASS)
    return tok


@pytest.fixture(scope="module")
def tenants(super_token):
    r = requests.get(f"{API}/tenants", headers=_hdr(super_token), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    by_name = {t["name"]: t for t in data}
    assert "SAUDALI ALIMENTOS" in by_name, f"SAUDALI missing: {list(by_name)}"
    assert "FS SOLUÇÕES DEMO" in by_name, f"DEMO missing: {list(by_name)}"
    return data, by_name


# ------- 1) Super-Admin login and /auth/me -------
class TestSuperAdmin:
    def test_login_returns_superadmin_role(self):
        _, data = _login(SUPER_EMAIL, SUPER_PASS)
        assert data["role"] == "superadmin"
        assert data.get("tenant_id") in (None, "", "null")

    def test_me_shows_null_tenant(self, super_token):
        r = requests.get(f"{API}/auth/me", headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "superadmin"
        # _scope_tenant should be None (no header sent)
        assert data.get("_scope_tenant") in (None, "", "null")
        assert data.get("tenant_id") in (None, "", "null")


# ------- 2) /api/tenants listing + RBAC -------
class TestTenantsEndpoint:
    def test_list_tenants_superadmin(self, tenants):
        data, by_name = tenants
        for t in data:
            assert "id" in t and "name" in t
            assert "machines_count" in t and isinstance(t["machines_count"], int)
            assert "users_count" in t and isinstance(t["users_count"], int)
        # SAUDALI has migrated data
        assert by_name["SAUDALI ALIMENTOS"]["machines_count"] > 0

    def test_tenant_admin_cannot_list_tenants(self, saudali_admin_token):
        r = requests.get(f"{API}/tenants", headers=_hdr(saudali_admin_token), timeout=15)
        assert r.status_code == 403


# ------- 3) Data isolation (super-admin) -------
class TestSuperAdminIsolation:
    def test_no_header_returns_empty_machines(self, super_token):
        r = requests.get(f"{API}/machines", headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_saudali_header_returns_data(self, super_token, tenants):
        _, by_name = tenants
        tid = by_name["SAUDALI ALIMENTOS"]["id"]
        r = requests.get(f"{API}/machines", headers=_hdr(super_token, tid), timeout=15)
        assert r.status_code == 200
        machines = r.json()
        assert len(machines) > 100, f"expected >100 SAUDALI machines, got {len(machines)}"
        for m in machines:
            assert m.get("tenant_id") == tid

    def test_demo_header_returns_data(self, super_token, tenants):
        _, by_name = tenants
        tid = by_name["FS SOLUÇÕES DEMO"]["id"]
        r = requests.get(f"{API}/machines", headers=_hdr(super_token, tid), timeout=15)
        assert r.status_code == 200
        machines = r.json()
        assert len(machines) > 0
        for m in machines:
            assert m.get("tenant_id") == tid

    def test_isolation_dashboard(self, super_token, tenants):
        _, by_name = tenants
        # No header
        r_empty = requests.get(f"{API}/dashboard", headers=_hdr(super_token), timeout=15)
        assert r_empty.status_code == 200
        d_empty = r_empty.json()
        # totals should be 0 (or at least equal to zero for machines)
        # Try a scoped call
        tid = by_name["SAUDALI ALIMENTOS"]["id"]
        r_s = requests.get(f"{API}/dashboard", headers=_hdr(super_token, tid), timeout=15)
        assert r_s.status_code == 200
        d_s = r_s.json()
        # basic assertion: at least one number differs
        assert d_empty != d_s

    def test_isolation_diagnostics_measurements_thermal(self, super_token, tenants):
        _, by_name = tenants
        tid = by_name["SAUDALI ALIMENTOS"]["id"]
        for path in ("/diagnostics", "/measurements", "/thermal"):
            r_empty = requests.get(f"{API}{path}", headers=_hdr(super_token), timeout=20)
            assert r_empty.status_code == 200, f"{path} no-header: {r_empty.status_code}"
            assert r_empty.json() == [], f"{path} should be empty for super-admin w/o header"
            r_scoped = requests.get(f"{API}{path}", headers=_hdr(super_token, tid), timeout=20)
            assert r_scoped.status_code == 200
            # scoped may or may not be non-empty depending on data present, just assert list
            assert isinstance(r_scoped.json(), list)


# ------- 4) Tenant-admin spoofing prevention -------
class TestTenantAdminIsolation:
    def test_saudali_admin_sees_own_data(self, saudali_admin_token):
        r = requests.get(f"{API}/machines", headers=_hdr(saudali_admin_token), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) > 100

    def test_saudali_admin_spoof_header_ignored(self, saudali_admin_token, demo_admin_token, tenants):
        _, by_name = tenants
        demo_tid = by_name["FS SOLUÇÕES DEMO"]["id"]
        saudali_tid = by_name["SAUDALI ALIMENTOS"]["id"]

        # Fetch saudali machines with no spoof
        r_own = requests.get(f"{API}/machines", headers=_hdr(saudali_admin_token), timeout=20)
        own_count = len(r_own.json())
        own_tids = {m.get("tenant_id") for m in r_own.json()}
        assert own_tids == {saudali_tid}

        # Now attempt to spoof to DEMO's tenant id
        r_spoof = requests.get(f"{API}/machines", headers=_hdr(saudali_admin_token, demo_tid), timeout=20)
        assert r_spoof.status_code == 200
        spoof_count = len(r_spoof.json())
        spoof_tids = {m.get("tenant_id") for m in r_spoof.json()}
        assert spoof_tids == {saudali_tid}, f"spoof header should be ignored, got tenants {spoof_tids}"
        assert spoof_count == own_count

    def test_tenant_admin_me(self, saudali_admin_token, tenants):
        _, by_name = tenants
        saudali_tid = by_name["SAUDALI ALIMENTOS"]["id"]
        r = requests.get(f"{API}/auth/me", headers=_hdr(saudali_admin_token, "some-fake-id"), timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me["tenant_id"] == saudali_tid
        assert me["_scope_tenant"] == saudali_tid  # ignores header


# ------- 5) Tenant CRUD + new tenant empty state -------
class TestTenantCRUD:
    _new_tid = {}

    def test_create_tenant_and_login(self, super_token):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_TenantCo_{suffix}",
            "admin_name": "TEST Admin",
            "admin_email": f"test_{suffix}@example.com",
            "admin_password": "TestPass123!",
        }
        r = requests.post(f"{API}/tenants", headers=_hdr(super_token), json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["admin_email"] == payload["admin_email"].lower()
        tid = body["id"]
        TestTenantCRUD._new_tid["id"] = tid
        TestTenantCRUD._new_tid["admin_email"] = payload["admin_email"]
        TestTenantCRUD._new_tid["admin_password"] = payload["admin_password"]

        # Verify via GET /tenants
        r_list = requests.get(f"{API}/tenants", headers=_hdr(super_token), timeout=15)
        names = [t["name"] for t in r_list.json()]
        assert payload["name"] in names

    def test_new_tenant_admin_empty_state(self, super_token):
        info = TestTenantCRUD._new_tid
        assert info, "must run create test first"
        tok, data = _login(info["admin_email"], info["admin_password"])
        assert data["role"] == "admin"
        assert data["tenant_id"] == info["id"]

        # No machines
        r = requests.get(f"{API}/machines", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

        # Dashboard reachable
        r_dash = requests.get(f"{API}/dashboard", headers=_hdr(tok), timeout=15)
        assert r_dash.status_code == 200

    def test_new_tenant_sees_global_defects(self, super_token):
        info = TestTenantCRUD._new_tid
        tok, _ = _login(info["admin_email"], info["admin_password"])
        r = requests.get(f"{API}/defects", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        defects = r.json()
        assert len(defects) > 0, "global defects library must not be empty"

    def test_delete_tenant(self, super_token):
        info = TestTenantCRUD._new_tid
        r = requests.delete(f"{API}/tenants/{info['id']}", headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200

        # Confirm removal
        r_list = requests.get(f"{API}/tenants", headers=_hdr(super_token), timeout=15)
        ids = [t["id"] for t in r_list.json()]
        assert info["id"] not in ids


# ------- 6) Global defects shared -------
class TestGlobalDefects:
    def test_saudali_and_demo_see_same_defects(self, saudali_admin_token, demo_admin_token):
        r_s = requests.get(f"{API}/defects", headers=_hdr(saudali_admin_token), timeout=15)
        r_d = requests.get(f"{API}/defects", headers=_hdr(demo_admin_token), timeout=15)
        assert r_s.status_code == 200 and r_d.status_code == 200
        s_names = sorted([d["nome"] for d in r_s.json()])
        d_names = sorted([d["nome"] for d in r_d.json()])
        assert s_names == d_names
        assert len(s_names) > 0

    def test_superadmin_sees_defects_without_tenant(self, super_token):
        r = requests.get(f"{API}/defects", headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200
        assert len(r.json()) > 0


# ------- 7) Write requires tenant scope -------
class TestWriteRequiresTenant:
    def test_superadmin_no_tenant_create_machine_400(self, super_token):
        payload = {
            "tag": f"TEST_M_{uuid.uuid4().hex[:6]}",
            "nome": "TEST machine",
            "tipo": "motor",
            "potencia_cv": 10,
            "rpm": 1800,
        }
        r = requests.post(f"{API}/machines", headers=_hdr(super_token), json=payload, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_superadmin_with_tenant_create_machine_200(self, super_token, tenants):
        _, by_name = tenants
        tid = by_name["FS SOLUÇÕES DEMO"]["id"]
        tag = f"TEST_M_{uuid.uuid4().hex[:6]}"
        payload = {
            "tag": tag,
            "nome": "TEST machine",
            "tipo": "motor",
            "potencia_cv": 10,
            "rpm": 1800,
        }
        r = requests.post(f"{API}/machines", headers=_hdr(super_token, tid), json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created.get("tenant_id") == tid
        mid = created["id"]

        # Verify persisted via GET
        r_get = requests.get(f"{API}/machines", headers=_hdr(super_token, tid), timeout=15)
        assert any(m["id"] == mid for m in r_get.json())

        # Cleanup
        r_del = requests.delete(f"{API}/machines/{mid}", headers=_hdr(super_token, tid), timeout=15)
        assert r_del.status_code in (200, 204)


# ------- 8) Regression: /auth/register scoped to tenant -------
class TestAuthRegisterScoped:
    def test_saudali_admin_registers_user_in_own_tenant(self, saudali_admin_token, tenants):
        _, by_name = tenants
        saudali_tid = by_name["SAUDALI ALIMENTOS"]["id"]
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "email": f"TEST_user_{suffix}@saudali.com",
            "password": "Pass123!",
            "name": "TEST User",
            "role": "visualizador",
        }
        r = requests.post(f"{API}/auth/register", headers=_hdr(saudali_admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == payload["email"].lower()

        # Verify appears in tenant users list
        r_users = requests.get(f"{API}/users", headers=_hdr(saudali_admin_token), timeout=15)
        assert r_users.status_code == 200
        emails = [u["email"] for u in r_users.json()]
        assert payload["email"].lower() in emails

        # Cleanup
        # find id
        user_id = next(u["id"] for u in r_users.json() if u["email"] == payload["email"].lower())
        # try delete via /users/{id}
        requests.delete(f"{API}/users/{user_id}", headers=_hdr(saudali_admin_token), timeout=15)

    def test_superadmin_register_without_tenant_400(self, super_token):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "email": f"TEST_noscope_{suffix}@example.com",
            "password": "Pass123!",
            "name": "TEST NoScope",
            "role": "visualizador",
        }
        r = requests.post(f"{API}/auth/register", headers=_hdr(super_token), json=payload, timeout=15)
        assert r.status_code == 400
