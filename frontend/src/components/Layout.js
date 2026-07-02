import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import {
  LayoutDashboard,
  Network,
  Cog,
  Activity,
  Flame,
  BookOpen,
  Stethoscope,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldAlert,
  BookText,
  Building2,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/clientes", label: "Clientes", icon: Building2, testid: "nav-clientes", superOnly: true },
  { to: "/plantas", label: "Plantas", icon: Network, testid: "nav-plantas", admin: true },
  { to: "/maquinas", label: "Máquinas", icon: Cog, testid: "nav-maquinas" },
  { to: "/vibracao", label: "Análise Vibração", icon: Activity, testid: "nav-vibracao" },
  { to: "/termografia", label: "Termografia", icon: Flame, testid: "nav-termografia" },
  { to: "/defeitos", label: "Biblioteca Defeitos", icon: BookOpen, testid: "nav-defeitos", admin: true },
  { to: "/diagnostico", label: "Diagnóstico", icon: Stethoscope, testid: "nav-diagnostico" },
  { to: "/relatorios", label: "Relatórios", icon: FileText, testid: "nav-relatorios" },
  { to: "/auditoria", label: "Auditoria", icon: ShieldAlert, testid: "nav-auditoria", adminOnly: true },
  { to: "/manual", label: "Manual", icon: BookText, testid: "nav-manual", adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: Users, testid: "nav-usuarios", admin: true },
];

function TenantSwitcher() {
  const { tenantId, setTenantId } = useAuth();
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/tenants");
        setTenants(data);
      } catch (e) { /* noop */ }
    })();
  }, []);

  const onChange = (id) => {
    setTenantId(id);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2" data-testid="tenant-switcher">
      <Building2 size={15} className="text-amber-500" />
      <select
        data-testid="tenant-select"
        value={tenantId || ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs border border-slate-300 rounded-md px-2 bg-white text-slate-700 max-w-[220px]"
      >
        <option value="">— Selecione um cliente —</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || isSuper;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        data-testid="sidebar"
        className={`bg-slate-900 text-white transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        } flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!collapsed && (
            <div className="font-display font-bold text-sm leading-tight">
              FS SOLUÇÕES
              <div className="text-[10px] tracking-widest text-amber-400 font-mono">PREDITIVA</div>
            </div>
          )}
          <button
            data-testid="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.filter((n) => {
            if (n.superOnly && !isSuper) return false;
            if (n.adminOnly && !isAdmin) return false;
            if (n.admin && user?.role === "visualizador") return false;
            return true;
          }).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <n.icon size={18} />
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          {!collapsed && (
            <div className="mb-2">
              <div className="text-xs text-slate-400">Logado como</div>
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              {isSuper && <div className="text-[10px] text-amber-400 font-mono mt-0.5">SUPER-ADMIN</div>}
            </div>
          )}
          <button
            data-testid="logout-btn"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="sidebar-link w-full"
          >
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-10">
          <h1 className="font-display text-lg font-semibold text-slate-900">
            FS Soluções — Preditiva
          </h1>
          <div className="ml-auto flex items-center gap-4">
            {isSuper && <TenantSwitcher />}
            <div className="text-xs font-mono text-slate-500">
              {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </div>
          </div>
        </header>
        <div className="p-6">
          {isSuper && !localStorage.getItem("fs_tenant") && (
            <div data-testid="no-tenant-banner" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Você é <b>Super-Admin</b>. Selecione um cliente no seletor acima para visualizar e gerenciar os dados, ou vá em <b>Clientes</b> para cadastrar um novo.
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
