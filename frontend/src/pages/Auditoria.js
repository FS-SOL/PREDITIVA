import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { formatDateTime } from "../lib/dates";
import { Search, ShieldAlert } from "lucide-react";

const TYPE_STYLE = {
  "diagnóstico": "bg-blue-100 text-blue-700",
  "medição": "bg-amber-100 text-amber-700",
  "medição (ponto)": "bg-amber-100 text-amber-700",
  "máquina": "bg-red-100 text-red-700",
  "defeito": "bg-purple-100 text-purple-700",
  "planta": "bg-teal-100 text-teal-700",
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/audit/deletions"); setLogs(data); } catch (e) { /* noop */ }
    })();
  }, []);

  const tipos = useMemo(() => Array.from(new Set(logs.map((l) => l.entity_type))), [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (tipo !== "todos" && l.entity_type !== tipo) return false;
    if (!q) return true;
    return [l.description, l.user_name, l.user_email, l.entity_type].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()));
  }), [logs, q, tipo]);

  return (
    <div className="space-y-4" data-testid="auditoria-page">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert size={22} /> Histórico de Exclusões
        </h2>
        <p className="text-sm text-slate-500">{filtered.length} evento(s) de exclusão registrados</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[250px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input data-testid="audit-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição, usuário..." className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
        </div>
        <select data-testid="audit-filter-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
          <option value="todos">Todos os tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="audit-table">
        <table className="fs-table w-full">
          <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Tipo</th><th>Descrição</th></tr></thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                <td className="whitespace-nowrap font-mono text-xs">{formatDateTime(l.data)}</td>
                <td className="text-sm">{l.user_name}<div className="text-[11px] text-slate-400">{l.user_email}</div></td>
                <td><span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_STYLE[l.entity_type] || "bg-slate-100 text-slate-600"}`}>{l.entity_type}</span></td>
                <td className="text-sm">{l.description}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-8">Nenhuma exclusão registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
