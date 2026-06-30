import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { Search, Save, History, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR = { OK: "#22C55E", A1: "#FACC15", A2: "#F97316", Parado: "#EF4444" };

export default function Diagnostico() {
  const { user } = useAuth();
  const canEdit = user?.role !== "visualizador";
  const [machines, setMachines] = useState([]);
  const [defects, setDefects] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [q, setQ] = useState("");
  const [machine, setMachine] = useState(null);
  const [selectedDefectIds, setSelectedDefectIds] = useState([]);
  const [form, setForm] = useState({ diagnostico: "", causa: "", consequencia: "", recomendacao: "", status: "A1" });
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [view, setView] = useState("cards"); // cards | history | banco
  const [historyQ, setHistoryQ] = useState("");
  const [expandedMachine, setExpandedMachine] = useState(null);

  const load = async () => {
    const [m, d, diag] = await Promise.all([api.get("/machines"), api.get("/defects"), api.get("/diagnostics")]);
    setMachines(m.data);
    setDefects(d.data);
    setDiagnostics(diag.data);
  };
  useEffect(() => { load(); }, []);

  const diagsByMachine = useMemo(() => {
    const m = {};
    diagnostics.forEach((d) => {
      m[d.machine_id] = m[d.machine_id] || [];
      m[d.machine_id].push(d);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.data || "").localeCompare(b.data || "")));
    return m;
  }, [diagnostics]);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      const isDiag = !!diagsByMachine[m.id];
      if (filterStatus === "diagnosticados" && !isDiag) return false;
      if (filterStatus === "pendentes" && isDiag) return false;
      if (filterStatus !== "todos" && filterStatus !== "diagnosticados" && filterStatus !== "pendentes" && m.status !== filterStatus) return false;
      if (filterTipo !== "todos" && !(m.tipo === filterTipo || m.tipo === "ambos")) return false;
      if (!q) return true;
      return [m.tag, m.equipamento, m.local].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()));
    });
  }, [machines, q, filterStatus, filterTipo, diagsByMachine]);

  const totalDiagnosticados = filtered.filter((m) => diagsByMachine[m.id]).length;
  const pendentes = filtered.length - totalDiagnosticados;

  const toggleDefect = (id) => {
    setSelectedDefectIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const sel = defects.filter((d) => next.includes(d.id));
      if (sel.length > 0) {
        setForm({
          diagnostico: sel.map((s) => s.diagnostico || s.nome).join(" + "),
          causa: sel.map((s) => s.causas).filter(Boolean).join("; "),
          consequencia: sel.map((s) => s.consequencias).filter(Boolean).join("; "),
          recomendacao: sel.map((s) => s.recomendacao || s.acoes).filter(Boolean).join("; "),
          status: sel.reduce((acc, s) => {
            const order = ["OK", "A1", "A2", "Parado"];
            return order.indexOf(s.alarme) > order.indexOf(acc) ? s.alarme : acc;
          }, "OK"),
        });
      } else {
        setForm({ diagnostico: "", causa: "", consequencia: "", recomendacao: "", status: "A1" });
      }
      return next;
    });
  };

  const save = async () => {
    if (!machine || !canEdit) return;
    if (selectedDefectIds.length === 0) { toast.error("Selecione ao menos um defeito"); return; }
    await api.post("/diagnostics", {
      machine_id: machine.id,
      machine_tag: machine.tag,
      defect_ids: selectedDefectIds,
      ...form,
    });
    toast.success("Diagnóstico salvo");
    setMachine(null);
    setSelectedDefectIds([]);
    setForm({ diagnostico: "", causa: "", consequencia: "", recomendacao: "", status: "A1" });
    load();
  };

  const historyFiltered = useMemo(() =>
    diagnostics.filter((d) => !historyQ || [d.machine_tag, d.diagnostico, d.recomendacao].some((v) => (v || "").toLowerCase().includes(historyQ.toLowerCase())))
  , [diagnostics, historyQ]);

  return (
    <div className="space-y-4" data-testid="diagnostico-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Diagnóstico</h2>
          <p className="text-sm text-slate-500">{totalDiagnosticados}/{filtered.length} diagnosticados — {pendentes} pendentes</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="view-cards-btn" onClick={() => setView("cards")} className={`h-9 px-3 text-sm rounded-md border ${view === "cards" ? "bg-slate-900 text-white" : "bg-white border-slate-300"}`}>Cards</button>
          <button data-testid="view-history-btn" onClick={() => setView("history")} className={`h-9 px-3 text-sm rounded-md border ${view === "history" ? "bg-slate-900 text-white" : "bg-white border-slate-300"}`}>Histórico por Máquina</button>
          <button data-testid="view-banco-btn" onClick={() => setView("banco")} className={`h-9 px-3 text-sm rounded-md border flex items-center gap-2 ${view === "banco" ? "bg-slate-900 text-white" : "bg-white border-slate-300"}`}>
            <History size={14} /> Banco
          </button>
        </div>
      </div>

      {view !== "banco" && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="diag-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar máquina por TAG ou nome..." className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
          </div>
          <select data-testid="diag-filter-tipo" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
            <option value="todos">Todos os tipos</option>
            <option value="vibracao">Análise de Vibração</option>
            <option value="termografia">Termografia</option>
          </select>
          <select data-testid="diag-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
            <option value="todos">Todos os status</option>
            <option value="pendentes">Pendentes</option>
            <option value="diagnosticados">Diagnosticados</option>
            <option value="OK">OK</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="Parado">Parado</option>
          </select>
        </div>
      )}

      {view === "banco" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={historyQ} onChange={(e) => setHistoryQ(e.target.value)} placeholder="Buscar TAG, diagnóstico..." className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="fs-table">
              <thead><tr><th>Data</th><th>TAG</th><th>Diagnóstico</th><th>Recomendação</th><th>Status</th><th>Técnico</th></tr></thead>
              <tbody>
                {historyFiltered.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">{(d.data || "").slice(0, 10)}</td>
                    <td className="font-mono font-semibold">{d.machine_tag}</td>
                    <td className="text-xs max-w-[300px]">{d.diagnostico}</td>
                    <td className="text-xs max-w-[300px]">{d.recomendacao}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="text-xs">{d.tecnico}</td>
                  </tr>
                ))}
                {historyFiltered.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-6">Nenhum diagnóstico</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "history" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="text-xs text-slate-500 px-4 py-2 border-b">Clique na linha de status para ver todos os diagnósticos da máquina.</div>
          <table className="fs-table">
            <thead><tr><th>TAG</th><th>Equipamento</th><th>Local</th><th>Status atual</th><th>Histórico de Diagnósticos</th></tr></thead>
            <tbody>
              {filtered.map((m) => {
                const hist = diagsByMachine[m.id] || [];
                return (
                  <tr key={m.id} data-testid={`history-row-${m.tag}`} className="cursor-pointer" onClick={() => setExpandedMachine(m)}>
                    <td className="font-mono font-semibold">{m.tag}</td>
                    <td>{m.equipamento}</td>
                    <td className="text-xs">{m.local}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      <div className="flex gap-1 items-center">
                        {hist.length === 0 ? <span className="text-xs text-slate-400 italic">sem histórico</span> :
                          hist.map((d, i) => (
                            <span key={d.id} title={`${(d.data || "").slice(0, 10)} — ${d.status}`} className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ background: STATUS_COLOR[d.status] }} />
                          ))
                        }
                        {hist.length > 0 && <span className="text-xs text-slate-500 ml-2 font-mono">{hist.length}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-6">Nenhuma máquina</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === "cards" && !machine && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) => {
            const isDiag = !!diagsByMachine[m.id];
            return (
              <button
                key={m.id}
                data-testid={`diag-card-${m.tag}`}
                onClick={() => canEdit ? setMachine(m) : setExpandedMachine(m)}
                className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-slate-900 hover:shadow-sm transition-all relative"
              >
                {isDiag && <span className="absolute top-2 right-2 text-[10px] uppercase font-bold tracking-wider text-emerald-600">✓ diag.</span>}
                <div className="flex items-start justify-between mb-2 pr-12">
                  <div className="font-mono font-bold text-sm">{m.tag}</div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="text-xs text-slate-600 truncate">{m.equipamento}</div>
                <div className="text-xs text-slate-400 truncate">{m.local}</div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center text-slate-500 py-8">Nenhuma máquina</div>}
        </div>
      )}

      {view === "cards" && machine && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">1. Marque os Defeitos</div>
            <div className="space-y-1.5 max-h-[60vh] overflow-auto">
              {defects.map((d) => (
                <label key={d.id} data-testid={`defect-check-${d.id}`} className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedDefectIds.includes(d.id)} onChange={() => toggleDefect(d.id)} className="mt-0.5" disabled={!canEdit} />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">{d.nome} <StatusBadge status={d.alarme} /></div>
                    <div className="text-[11px] text-slate-500">{d.categoria}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">2. Máquina</div>
                <div className="font-mono font-bold text-slate-900">{machine.tag}</div>
                <div className="text-xs text-slate-500">{machine.equipamento}</div>
              </div>
              <button onClick={() => { setMachine(null); setSelectedDefectIds([]); }} className="text-xs text-slate-500 hover:text-slate-900">← Voltar</button>
            </div>
            <div className="space-y-3">
              {[["diagnostico", "Diagnóstico"], ["causa", "Causa"], ["consequencia", "Consequência"], ["recomendacao", "Recomendação"]].map(([k, lab]) => (
                <div key={k}>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{lab} (auto)</label>
                  <textarea value={form[k]} readOnly rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-md text-sm text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">3. Edite e Salve</div>
            <div className="space-y-3">
              {[["diagnostico", "Diagnóstico final"], ["causa", "Causa"], ["consequencia", "Consequência"], ["recomendacao", "Recomendação"]].map(([k, lab]) => (
                <div key={k}>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{lab}</label>
                  <textarea data-testid={`diag-edit-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={3} disabled={!canEdit} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-50" />
                </div>
              ))}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Novo Status da Máquina</label>
                <select data-testid="diag-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!canEdit} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white disabled:bg-slate-50">
                  {["OK", "A1", "A2", "Parado"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <button data-testid="save-diag-btn" onClick={save} disabled={!canEdit} className="w-full h-10 bg-slate-900 text-white rounded-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50">
                <Save size={14} /> Salvar Diagnóstico
              </button>
              {!canEdit && <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">Usuário visualizador: edição bloqueada.</div>}
            </div>
          </div>
        </div>
      )}

      {expandedMachine && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setExpandedMachine(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono font-bold text-lg">{expandedMachine.tag}</div>
                <div className="text-sm text-slate-500">{expandedMachine.equipamento} — {expandedMachine.local}</div>
              </div>
              <button onClick={() => setExpandedMachine(null)} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
            </div>
            <h4 className="font-semibold mb-2">Histórico de Diagnósticos</h4>
            <div className="space-y-2">
              {(diagsByMachine[expandedMachine.id] || []).slice().reverse().map((d) => (
                <div key={d.id} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-mono text-xs text-slate-500">{(d.data || "").slice(0, 16).replace("T", " ")}</div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="text-sm font-medium">{d.diagnostico}</div>
                  {d.causa && <div className="text-xs text-slate-600 mt-1"><b>Causa:</b> {d.causa}</div>}
                  {d.consequencia && <div className="text-xs text-slate-600"><b>Consequência:</b> {d.consequencia}</div>}
                  {d.recomendacao && <div className="text-xs text-slate-600"><b>Recomendação:</b> {d.recomendacao}</div>}
                  {d.tecnico && <div className="text-[11px] text-slate-400 mt-1">Técnico: {d.tecnico}</div>}
                </div>
              ))}
              {(diagsByMachine[expandedMachine.id] || []).length === 0 && (
                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Sem diagnósticos registrados.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
