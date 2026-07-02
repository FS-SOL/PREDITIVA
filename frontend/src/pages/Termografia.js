import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { formatDate, formatDateTime } from "../lib/dates";
import StatusBadge from "../components/StatusBadge";
import { Search, Flame, Upload, LayoutGrid, List, Thermometer, Download, Table2, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const ALARM_COLOR = { OK: "#DCFCE7", A1: "#FEF9C3", A2: "#FFEDD5", Parado: "#FEE2E2" };
function tempAlarm(t) {
  const v = Number(t);
  if (Number.isNaN(v)) return "OK";
  if (v <= 60) return "OK"; if (v <= 90) return "A1"; if (v <= 120) return "A2"; return "Parado";
}

export default function Termografia() {
  const { user } = useAuth();
  const canEdit = user?.role !== "visualizador";
  const [machines, setMachines] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [thermal, setThermal] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("cards");
  const [tab, setTab] = useState("pontos");
  const [machineFilter, setMachineFilter] = useState("todas");
  const [trendPoint, setTrendPoint] = useState(null);
  const fileRef = useRef(null);
  const tempFileRef = useRef(null);

  const load = async () => {
    const { data } = await api.get("/machines?tipo=termografia");
    setMachines(data);
    const { data: d } = await api.get("/diagnostics");
    setDiagnostics(d);
    const { data: t } = await api.get("/thermal");
    setThermal(t);
  };
  useEffect(() => { load(); }, []);

  const latestByPoint = useMemo(() => {
    const map = {};
    for (const t of thermal) {
      const key = `${t.machine_id}||${t.ponto}`;
      const cur = map[key];
      if (!cur || (t.data || "") > (cur.data || "")) map[key] = t;
    }
    return Object.values(map).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [thermal]);

  const maxByMachine = useMemo(() => {
    const map = {};
    for (const t of latestByPoint) {
      const cur = map[t.machine_id];
      if (!cur || t.temperatura > cur.temperatura) map[t.machine_id] = { temperatura: t.temperatura, ponto: t.ponto };
    }
    return map;
  }, [latestByPoint]);

  const measuredMachines = useMemo(() => {
    const seen = {};
    for (const t of thermal) if (!seen[t.machine_id]) seen[t.machine_id] = t.machine_tag || t.machine_id;
    return Object.entries(seen).map(([id, tag]) => ({ id, tag })).sort((a, b) => a.tag.localeCompare(b.tag));
  }, [thermal]);

  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    toast.message("Importando lista de termografia...");
    try {
      const { data } = await api.post(`/machines/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Importados ${data.inserted} pontos${data.skipped ? ` (${data.skipped} já existentes)` : ""}`);
      load();
    } catch (err) { toast.error("Falha ao importar. Verifique a aba com 'TERMO' no nome."); }
    fileRef.current.value = "";
  };

  const uploadTemp = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    toast.message("Importando temperaturas...");
    try {
      const { data } = await api.post(`/thermal/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Importadas ${data.inserted} temperaturas${data.skipped ? ` (${data.skipped} ignoradas)` : ""}`);
      load();
    } catch (err) { toast.error("Falha na importação"); }
    tempFileRef.current.value = "";
  };

  const download = async (path, filename) => {
    try {
      const params = machineFilter !== "todas" && path.includes("export") ? { machine_id: machineFilter } : {};
      const res = await api.get(path, { responseType: "blob", params });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { toast.error("Falha ao gerar arquivo"); }
  };

  const deletePoint = async (t) => {
    if (!window.confirm(`Excluir todas as temperaturas do ponto ${t.ponto || "—"} de ${t.machine_tag}?`)) return;
    try {
      await api.delete(`/thermal/point/clear`, { params: { machine_id: t.machine_id, ponto: t.ponto || "" } });
      toast.success("Temperaturas excluídas"); load();
    } catch (err) { toast.error("Falha ao excluir"); }
  };

  const filtered = useMemo(
    () => machines.filter((m) => !q || [m.tag, m.equipamento, m.local, m.componente].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))),
    [machines, q]
  );

  const tempRows = useMemo(() => latestByPoint
    .filter((t) => machineFilter === "todas" || t.machine_id === machineFilter)
    .filter((t) => !q || [t.machine_tag, t.ponto].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))),
    [latestByPoint, machineFilter, q]);

  const pivot = useMemo(() => {
    const src = thermal.filter((t) => machineFilter === "todas" || t.machine_id === machineFilter)
      .filter((t) => !q || [t.machine_tag, t.ponto].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));
    const colSet = new Set(); const rowMap = {};
    for (const t of src) {
      const col = t.data || ""; colSet.add(col);
      const key = `${t.machine_id}||${t.ponto}`;
      if (!rowMap[key]) rowMap[key] = { machine_tag: t.machine_tag, ponto: t.ponto, ordem: t.ordem || 0, values: {} };
      rowMap[key].values[col] = t.temperatura;
    }
    const cols = Array.from(colSet).sort((a, b) => (a || "").localeCompare(b || ""));
    const rows = Object.values(rowMap).sort((a, b) => (a.machine_tag || "").localeCompare(b.machine_tag || "") || (a.ordem - b.ordem));
    return { cols, rows };
  }, [thermal, machineFilter, q]);

  const pointHistory = useMemo(() => {
    if (!trendPoint) return [];
    return thermal.filter((t) => t.machine_id === trendPoint.machine_id && t.ponto === trendPoint.ponto)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
      .map((t) => ({ data: formatDateTime(t.data), temp: t.temperatura }));
  }, [trendPoint, thermal]);

  const TabBtn = ({ id, icon: Icon, label, testid }) => (
    <button data-testid={testid} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors ${tab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-4" data-testid="termografia-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Termografia</h2>
          <p className="text-sm text-slate-500">{filtered.length} pontos • {latestByPoint.length} com temperatura</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button data-testid="thermal-template-btn" onClick={() => download("/thermal/template", "template_termografia.xlsx")} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2 hover:bg-slate-50">
            <Download size={14} /> Template Temp.
          </button>
          {canEdit && <>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={upload} className="hidden" data-testid="termo-file-input" />
            <button data-testid="import-termo-btn" onClick={() => fileRef.current?.click()} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2 hover:bg-slate-50">
              <Upload size={14} /> Importar Lista
            </button>
            <input ref={tempFileRef} type="file" accept=".xlsx" onChange={uploadTemp} className="hidden" data-testid="temp-file-input" />
            <button data-testid="import-temp-btn" onClick={() => tempFileRef.current?.click()} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2 hover:bg-slate-800">
              <Thermometer size={14} /> Importar Temperaturas
            </button>
          </>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <TabBtn id="pontos" icon={LayoutGrid} label="Pontos" testid="tab-pontos" />
        <TabBtn id="temperaturas" icon={Thermometer} label="Temperaturas" testid="tab-temperaturas" />
        <TabBtn id="tabela" icon={Table2} label="Tabela de Dados" testid="tab-tabela-termo" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar TAG/quadro..." className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
        </div>
        {tab === "pontos" && (
          <div className="flex gap-1 ml-auto">
            <button data-testid="termo-view-cards" onClick={() => setView("cards")} className={`h-10 px-3 text-sm rounded-md border flex items-center gap-2 ${view === "cards" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-600"}`}><LayoutGrid size={14} /> Cards</button>
            <button data-testid="termo-view-lista" onClick={() => setView("lista")} className={`h-10 px-3 text-sm rounded-md border flex items-center gap-2 ${view === "lista" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-600"}`}><List size={14} /> Lista</button>
          </div>
        )}
        {tab !== "pontos" && (
          <select data-testid="termo-machine-filter" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
            <option value="todas">Todas as máquinas ({measuredMachines.length})</option>
            {measuredMachines.map((mm) => <option key={mm.id} value={mm.id}>{mm.tag}</option>)}
          </select>
        )}
        {tab === "tabela" && (
          <button data-testid="export-tabela-termo-btn" onClick={() => download("/thermal/export", "tabela_dados_termografia.xlsx")} className="h-10 px-3 text-sm bg-emerald-600 text-white rounded-md flex items-center gap-2 hover:bg-emerald-700">
            <Download size={14} /> Exportar Excel
          </button>
        )}
      </div>

      {tab === "pontos" && view === "lista" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="termo-lista">
          <table className="fs-table w-full">
            <thead><tr><th>TAG</th><th>Equipamento</th><th>Local</th><th>Componente</th><th>Máx °C</th><th>Status</th><th>Últ. diag.</th></tr></thead>
            <tbody>
              {filtered.map((m) => {
                const mDiags = diagnostics.filter((d) => d.machine_id === m.id);
                const isDiag = mDiags.length > 0;
                const last = isDiag ? mDiags.sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] : null;
                const mx = maxByMachine[m.id];
                return (
                  <tr key={m.id} data-testid={`termo-lista-row-${m.tag}`}>
                    <td className="font-mono font-semibold text-xs">{m.tag}</td>
                    <td className="text-xs">{m.equipamento}</td>
                    <td className="text-xs">{m.local}</td>
                    <td className="text-xs">{m.componente || "—"}</td>
                    <td className="font-mono text-xs text-orange-700">{mx ? `${mx.temperatura}°C` : "—"}</td>
                    <td><StatusBadge status={isDiag ? m.status : "Sem diag."} /></td>
                    <td className="text-xs font-mono">{last ? formatDate(last.data) : "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">Nenhum ponto cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "pontos" && view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) => {
            const mDiags = diagnostics.filter((d) => d.machine_id === m.id);
            const isDiag = mDiags.length > 0;
            const last = isDiag ? mDiags.sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] : null;
            const mx = maxByMachine[m.id];
            return (
              <div key={m.id} data-testid={`termo-card-${m.tag}`} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame size={14} className="text-orange-500 shrink-0" />
                    <div className="font-mono font-bold text-sm truncate">{m.tag}</div>
                  </div>
                  <StatusBadge status={isDiag ? m.status : "Sem diag."} />
                </div>
                <div className="text-xs text-slate-600 truncate">{m.equipamento}</div>
                <div className="text-xs text-slate-400 truncate">{m.local}</div>
                {m.componente && <div className="text-[11px] text-slate-500 mt-1">Componente: {m.componente}</div>}
                <div className="mt-2 text-[11px]" data-testid={`termo-max-${m.tag}`}>
                  {mx ? <span className="font-mono text-orange-700">Máx: {mx.temperatura}°C @ {mx.ponto || "—"}</span> : <span className="text-slate-400 italic">Sem temperatura</span>}
                </div>
                <div className="mt-0.5 text-[11px]">
                  {last ? <span className="font-mono text-emerald-700">Últ. diag: {formatDate(last.data)}</span> : <span className="text-slate-400 italic">Sem diagnóstico</span>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-slate-500 text-sm p-6 text-center">Nenhum ponto cadastrado. Use "Importar Lista".</div>}
        </div>
      )}

      {tab === "temperaturas" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="temperaturas-table">
          <table className="fs-table w-full">
            <thead><tr><th>Equipamento</th><th>Ponto</th><th>Temp. atual</th><th>Ambiente</th><th>ΔT</th><th>Alarme</th><th>Atualizado</th><th>Tendência</th>{canEdit && <th>Ações</th>}</tr></thead>
            <tbody>
              {tempRows.map((t) => (
                <tr key={t.id} data-testid={`temp-row-${t.id}`}>
                  <td className="font-mono text-xs">{t.machine_tag}</td>
                  <td>{t.ponto || "—"}</td>
                  <td className="font-mono font-semibold">{t.temperatura}°C</td>
                  <td className="text-xs">{t.temp_ambiente != null ? `${t.temp_ambiente}°C` : "—"}</td>
                  <td className="font-mono text-xs">{t.delta_t != null ? `${t.delta_t}°C` : "—"}</td>
                  <td><StatusBadge status={t.alarme} /></td>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(t.data)}</td>
                  <td><button data-testid={`temp-trend-${t.id}`} onClick={() => setTrendPoint(t)} className="p-1 hover:bg-slate-100 rounded text-slate-700 inline-flex items-center gap-1 text-xs"><TrendingUp size={14} /> Ver</button></td>
                  {canEdit && <td><button data-testid={`del-temp-${t.id}`} onClick={() => deletePoint(t)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button></td>}
                </tr>
              ))}
              {tempRows.length === 0 && <tr><td colSpan={canEdit ? 9 : 8} className="text-center text-slate-500 py-8">Nenhuma temperatura. Baixe o template, preencha e importe.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tabela" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="tabela-dados-termo">
          <table className="fs-table w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-100 z-10">Equipamento</th><th>Ponto</th>
                {pivot.cols.map((c) => <th key={c} className="whitespace-nowrap text-center">{formatDateTime(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r, i) => (
                <tr key={i} data-testid={`tabela-termo-row-${i}`}>
                  <td className="font-mono text-xs sticky left-0 bg-white z-10">{r.machine_tag}</td>
                  <td>{r.ponto || "—"}</td>
                  {pivot.cols.map((c) => {
                    const v = r.values[c];
                    const al = v !== undefined ? tempAlarm(v) : null;
                    return <td key={c} className="text-center font-mono" style={al ? { background: ALARM_COLOR[al] } : undefined}>{v !== undefined ? `${v}°` : "—"}</td>;
                  })}
                </tr>
              ))}
              {pivot.rows.length === 0 && <tr><td colSpan={2 + pivot.cols.length} className="text-center text-slate-500 py-8">Sem dados. Importe temperaturas para montar o histórico.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {trendPoint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTrendPoint(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()} data-testid="temp-trend-modal">
            <h3 className="font-display font-bold text-lg mb-1">Tendência de Temperatura — {trendPoint.ponto || "—"}</h3>
            <div className="text-sm text-slate-500 mb-4">{trendPoint.machine_tag}</div>
            {pointHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={pointHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="°C" />
                  <Tooltip />
                  <Line type="monotone" dataKey="temp" stroke="#EA580C" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Apenas uma leitura registrada. Importe novos valores para ver a tendência.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
