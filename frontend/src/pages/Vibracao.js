import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { formatDate, formatDateTime } from "../lib/dates";
import StatusBadge from "../components/StatusBadge";
import { Upload, Search, TrendingUp, Download, Gauge, LayoutGrid, Trash2, Table2, List } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const STATUS_COLOR = { OK: "#22C55E", A1: "#FACC15", A2: "#F97316", Parado: "#EF4444", "Sem diag.": "#94A3B8" };
const ALARM_COLOR = { OK: "#DCFCE7", A1: "#FEF9C3", A2: "#FFEDD5", Parado: "#FEE2E2" };

function isoAlarm(valor, unidade, deteccao) {
  const v = Number(valor);
  if (Number.isNaN(v)) return "OK";
  const u = (unidade || "").toLowerCase();
  const d = (deteccao || "").toLowerCase();
  const isVel = u.includes("mm/s") || d.includes("veloc");
  const isAcc = u.trim() === "g" || u.includes("m/s") || d.includes("acel");
  if (isAcc && !isVel) {
    if (v <= 2) return "OK"; if (v <= 5) return "A1"; if (v <= 10) return "A2"; return "Parado";
  }
  if (v <= 2.8) return "OK"; if (v <= 7.1) return "A1"; if (v <= 11) return "A2"; return "Parado";
}

export default function Vibracao() {
  const { user } = useAuth();
  const canEdit = user?.role !== "visualizador";
  const [machines, setMachines] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("maquinas");
  const [maquinasView, setMaquinasView] = useState("cards");
  const [machineFilter, setMachineFilter] = useState("todas");
  const [selected, setSelected] = useState(null);
  const [trendPoint, setTrendPoint] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const { data } = await api.get("/machines?tipo=vibracao");
    setMachines(data);
    const { data: m } = await api.get("/measurements");
    setMeasurements(m);
    const { data: d } = await api.get("/diagnostics");
    setDiagnostics(d);
  };
  useEffect(() => { load(); }, []);

  // Latest measurement per (machine, ponto, deteccao) — preserva ordem da planilha
  const latestByPoint = useMemo(() => {
    const map = {};
    for (const m of measurements) {
      const key = `${m.machine_id}||${m.ponto}||${m.deteccao}`;
      const cur = map[key];
      if (!cur || (m.data || "") > (cur.data || "")) map[key] = m;
    }
    return Object.values(map).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [measurements]);

  const peakByMachine = useMemo(() => {
    const map = {};
    for (const m of latestByPoint) {
      const cur = map[m.machine_id];
      if (!cur || m.valor > cur.valor) map[m.machine_id] = { valor: m.valor, unidade: m.unidade, ponto: m.ponto };
    }
    return map;
  }, [latestByPoint]);

  const diagsByMachine = useMemo(() => {
    const map = {};
    for (const d of diagnostics) {
      (map[d.machine_id] = map[d.machine_id] || []).push(d);
    }
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.data || "").localeCompare(b.data || "")));
    return map;
  }, [diagnostics]);

  const measuredMachines = useMemo(() => {
    const seen = {};
    for (const m of measurements) if (!seen[m.machine_id]) seen[m.machine_id] = m.machine_tag || m.machine_id;
    return Object.entries(seen).map(([id, tag]) => ({ id, tag })).sort((a, b) => a.tag.localeCompare(b.tag));
  }, [measurements]);

  const filtered = useMemo(
    () => machines.filter((m) => !q || [m.tag, m.equipamento, m.local, m.descricao].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))),
    [machines, q]
  );

  const medicoesRows = useMemo(() => {
    return latestByPoint
      .filter((m) => machineFilter === "todas" || m.machine_id === machineFilter)
      .filter((m) => !q || [m.machine_tag, m.subconjunto, m.ponto, m.deteccao].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));
  }, [latestByPoint, machineFilter, q]);

  // Pivot: linhas = equipamento/ponto, colunas = cada importação (data+hora)
  const pivot = useMemo(() => {
    const src = measurements
      .filter((m) => machineFilter === "todas" || m.machine_id === machineFilter)
      .filter((m) => !q || [m.machine_tag, m.ponto, m.deteccao].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));
    const colSet = new Set();
    const rowMap = {};
    for (const m of src) {
      const col = m.data || "";
      colSet.add(col);
      const key = `${m.machine_id}||${m.ponto}||${m.deteccao}`;
      if (!rowMap[key]) rowMap[key] = { machine_tag: m.machine_tag, ponto: m.ponto, deteccao: m.deteccao, unidade: m.unidade, ordem: m.ordem || 0, values: {} };
      rowMap[key].values[col] = m.valor;
    }
    const cols = Array.from(colSet).sort((a, b) => (a || "").localeCompare(b || ""));
    const rows = Object.values(rowMap).sort((a, b) => (a.machine_tag || "").localeCompare(b.machine_tag || "") || (a.ordem - b.ordem));
    return { cols, rows };
  }, [measurements, machineFilter, q]);

  const pointHistory = useMemo(() => {
    if (!trendPoint) return [];
    return measurements
      .filter((m) => m.machine_id === trendPoint.machine_id && m.ponto === trendPoint.ponto && m.deteccao === trendPoint.deteccao)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
      .map((m) => ({ data: formatDateTime(m.data), valor: m.valor }));
  }, [trendPoint, measurements]);

  const selectedPoints = useMemo(() => {
    if (!selected) return [];
    return latestByPoint.filter((m) => m.machine_id === selected.id);
  }, [selected, latestByPoint]);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    toast.message("Importando medidas...");
    try {
      const { data } = await api.post(`/measurements/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Importadas ${data.inserted} medidas${data.skipped ? ` (${data.skipped} ignoradas)` : ""}`);
      load();
    } catch (err) { toast.error("Falha na importação"); }
    fileRef.current.value = "";
  };

  const downloadTemplate = async () => {
    toast.message("Gerando template...");
    try {
      const res = await api.get("/measurements/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "template_overall_vibracao.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { toast.error("Falha ao gerar template"); }
  };

  const deletePoint = async (m) => {
    if (!window.confirm(`Excluir todas as medições do ponto ${m.ponto} (${m.deteccao}) de ${m.machine_tag}?`)) return;
    try {
      await api.delete(`/measurements/point/clear`, { params: { machine_id: m.machine_id, ponto: m.ponto || "", deteccao: m.deteccao || "" } });
      toast.success("Medições excluídas");
      load();
    } catch (err) { toast.error("Falha ao excluir"); }
  };

  const TabBtn = ({ id, icon: Icon, label, testid }) => (
    <button data-testid={testid} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors ${tab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-4" data-testid="vibracao-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Análise de Vibração</h2>
          <p className="text-sm text-slate-500">{filtered.length} máquinas • {latestByPoint.length} pontos monitorados</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="download-template-btn" onClick={downloadTemplate} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2 hover:bg-slate-50">
            <Download size={14} /> Baixar Template
          </button>
          {canEdit && <>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={upload} className="hidden" data-testid="meas-file-input" />
            <button data-testid="import-meas-btn" onClick={() => fileRef.current?.click()} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2 hover:bg-slate-800">
              <Upload size={14} /> Importar Overall
            </button>
          </>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <TabBtn id="maquinas" icon={LayoutGrid} label="Máquinas" testid="tab-maquinas" />
        <TabBtn id="medicoes" icon={Gauge} label="Medições" testid="tab-medicoes" />
        <TabBtn id="tabela" icon={Table2} label="Tabela de Dados" testid="tab-tabela" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "maquinas" ? "Buscar máquina..." : "Buscar medição..."} className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
        </div>
        {tab !== "maquinas" && (
          <select data-testid="medicoes-machine-filter" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
            <option value="todas">Todas as máquinas ({measuredMachines.length})</option>
            {measuredMachines.map((mm) => <option key={mm.id} value={mm.id}>{mm.tag}</option>)}
          </select>
        )}
        {tab === "maquinas" && (
          <div className="flex gap-1 ml-auto">
            <button data-testid="view-cards-btn" onClick={() => setMaquinasView("cards")} className={`h-10 px-3 text-sm rounded-md border flex items-center gap-2 ${maquinasView === "cards" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-600"}`}><LayoutGrid size={14} /> Cards</button>
            <button data-testid="view-lista-btn" onClick={() => setMaquinasView("lista")} className={`h-10 px-3 text-sm rounded-md border flex items-center gap-2 ${maquinasView === "lista" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-600"}`}><List size={14} /> Lista</button>
          </div>
        )}
      </div>

      {tab === "maquinas" && maquinasView === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) => {
            const points = latestByPoint.filter((x) => x.machine_id === m.id).length;
            const peak = peakByMachine[m.id];
            const hist = diagsByMachine[m.id] || [];
            const isDiag = hist.length > 0;
            const last = isDiag ? hist[hist.length - 1] : null;
            const displayStatus = isDiag ? m.status : "Sem diag.";
            return (
              <button key={m.id} data-testid={`vibracao-card-${m.tag}`} onClick={() => setSelected(m)}
                className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-slate-900 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="font-mono font-bold text-sm truncate">{m.tag}</div>
                  <StatusBadge status={displayStatus} />
                </div>
                <div className="text-xs text-slate-600 truncate">{m.equipamento}</div>
                <div className="text-xs text-slate-400 truncate">{m.local}</div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono">{m.rpm || "-"} RPM</span>
                  <span className="font-mono">{points} pontos</span>
                </div>
                <div className="mt-1 text-[11px]" data-testid={`vibracao-peak-${m.tag}`}>
                  {peak ? <span className="font-mono text-amber-700">Pico: {peak.valor} {peak.unidade} @ {peak.ponto || "—"}</span> : <span className="text-slate-400 italic">Sem medições</span>}
                </div>
                <div className="mt-2 flex items-center gap-1 flex-wrap" data-testid={`vibracao-timeline-${m.tag}`}>
                  {hist.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Sem diagnóstico</span>
                  ) : (
                    <>
                      {hist.map((d) => (
                        <span key={d.id} title={`${(d.data || "").slice(0, 10)} — ${d.status}`} className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ background: STATUS_COLOR[d.status] || "#94A3B8" }} />
                      ))}
                      <span className="text-[10px] text-slate-500 ml-1 font-mono">{formatDate(last.data)}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "maquinas" && maquinasView === "lista" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="maquinas-lista">
          <table className="fs-table w-full">
            <thead>
              <tr><th>TAG</th><th>Equipamento</th><th>Local</th><th>RPM</th><th>Pontos</th><th>Pico</th><th>Status</th><th>Diagnósticos</th></tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const points = latestByPoint.filter((x) => x.machine_id === m.id).length;
                const peak = peakByMachine[m.id];
                const hist = diagsByMachine[m.id] || [];
                const displayStatus = hist.length > 0 ? m.status : "Sem diag.";
                return (
                  <tr key={m.id} data-testid={`maquina-lista-row-${m.tag}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(m)}>
                    <td className="font-mono font-semibold text-xs">{m.tag}</td>
                    <td className="text-xs">{m.equipamento}</td>
                    <td className="text-xs">{m.local}</td>
                    <td className="font-mono text-xs">{m.rpm || "-"}</td>
                    <td className="font-mono text-xs">{points}</td>
                    <td className="font-mono text-xs text-amber-700">{peak ? `${peak.valor} ${peak.unidade} @ ${peak.ponto}` : "—"}</td>
                    <td><StatusBadge status={displayStatus} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {hist.map((d) => <span key={d.id} title={`${(d.data || "").slice(0, 10)} — ${d.status}`} className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[d.status] || "#94A3B8" }} />)}
                        {hist.length === 0 && <span className="text-[11px] text-slate-400 italic">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">Nenhuma máquina</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "medicoes" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="medicoes-table">
          <table className="fs-table w-full">
            <thead>
              <tr>
                <th>Equipamento</th><th>Subconjunto</th><th>Ponto</th>
                <th>Valor atual</th><th>Unidade</th><th>Detecção</th><th>Alarme</th><th>Atualizado</th><th>Tendência</th>
                {canEdit && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {medicoesRows.map((m) => (
                <tr key={m.id} data-testid={`medicao-row-${m.id}`}>
                  <td className="font-mono text-xs">{m.machine_tag}</td>
                  <td>{m.subconjunto || "—"}</td>
                  <td>{m.ponto || "—"}</td>
                  <td className="font-mono font-semibold">{m.valor}</td>
                  <td>{m.unidade || "—"}</td>
                  <td>{m.deteccao || "—"}</td>
                  <td><StatusBadge status={m.alarme} /></td>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(m.data)}</td>
                  <td>
                    <button data-testid={`trend-btn-${m.id}`} onClick={() => setTrendPoint(m)} className="p-1 hover:bg-slate-100 rounded text-slate-700 inline-flex items-center gap-1 text-xs">
                      <TrendingUp size={14} /> Ver
                    </button>
                  </td>
                  {canEdit && (
                    <td>
                      <button data-testid={`del-meas-${m.id}`} onClick={() => deletePoint(m)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {medicoesRows.length === 0 && (
                <tr><td colSpan={canEdit ? 10 : 9} className="text-center text-slate-500 py-8">Nenhuma medição. Baixe o template, preencha e importe em "Importar Overall".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tabela" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="tabela-dados">
          <table className="fs-table w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-100 z-10">Equipamento</th>
                <th>Ponto</th><th>Detecção</th><th>Un.</th>
                {pivot.cols.map((c) => <th key={c} className="whitespace-nowrap text-center">{formatDateTime(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r, i) => (
                <tr key={i} data-testid={`tabela-row-${i}`}>
                  <td className="font-mono text-xs sticky left-0 bg-white z-10">{r.machine_tag}</td>
                  <td>{r.ponto || "—"}</td>
                  <td className="text-xs">{r.deteccao || "—"}</td>
                  <td className="text-xs">{r.unidade || "—"}</td>
                  {pivot.cols.map((c) => {
                    const v = r.values[c];
                    const al = v !== undefined ? isoAlarm(v, r.unidade, r.deteccao) : null;
                    return (
                      <td key={c} className="text-center font-mono" style={al ? { background: ALARM_COLOR[al] } : undefined}>
                        {v !== undefined ? v : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {pivot.rows.length === 0 && (
                <tr><td colSpan={4 + pivot.cols.length} className="text-center text-slate-500 py-8">Sem dados. Importe medições para montar o histórico por datas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend modal for a single point */}
      {trendPoint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTrendPoint(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()} data-testid="trend-modal">
            <h3 className="font-display font-bold text-lg mb-1">Tendência — {trendPoint.ponto} ({trendPoint.deteccao})</h3>
            <div className="text-sm text-slate-500 mb-4">{trendPoint.machine_tag}</div>
            {pointHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={pointHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="valor" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Apenas uma medição registrada. Importe novos valores mensalmente para ver a tendência.</div>
            )}
          </div>
        </div>
      )}

      {/* Machine detail modal — pontos por ponto */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()} data-testid="machine-modal">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-xl">{selected.tag}</h3>
                <div className="text-sm text-slate-500">{selected.equipamento} — {selected.local}</div>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div className="bg-slate-50 p-3 rounded"><div className="text-xs text-slate-500">RPM</div><div className="font-mono font-semibold">{selected.rpm || "-"}</div></div>
              <div className="bg-slate-50 p-3 rounded"><div className="text-xs text-slate-500">Potência</div><div className="font-mono font-semibold">{selected.potencia || "-"} cv</div></div>
              <div className="bg-slate-50 p-3 rounded"><div className="text-xs text-slate-500">Criticidade</div><div className="font-mono font-semibold">{selected.criticidade}</div></div>
            </div>

            <h4 className="font-semibold flex items-center gap-2 mb-2"><Gauge size={16}/> Pontos e valores atuais</h4>
            {selectedPoints.length > 0 ? (
              <div className="overflow-auto">
                <table className="fs-table w-full">
                  <thead><tr><th>Ponto</th><th>Detecção</th><th>Valor</th><th>Un.</th><th>Alarme</th><th>Tendência</th></tr></thead>
                  <tbody>
                    {selectedPoints.map((p) => (
                      <tr key={p.id}>
                        <td>{p.ponto || "—"}</td>
                        <td className="text-xs">{p.deteccao || "—"}</td>
                        <td className="font-mono font-semibold">{p.valor}</td>
                        <td>{p.unidade}</td>
                        <td><StatusBadge status={p.alarme} /></td>
                        <td>
                          <button data-testid={`modal-trend-${p.id}`} onClick={() => setTrendPoint(p)} className="p-1 hover:bg-slate-100 rounded text-slate-700 inline-flex items-center gap-1 text-xs">
                            <TrendingUp size={14} /> Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Sem medições importadas para esta máquina.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
