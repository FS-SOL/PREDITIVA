import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
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

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            if (n.adminOnly && user?.role !== "admin") return false;
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
          <div className="ml-auto text-xs font-mono text-slate-500">
            {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
