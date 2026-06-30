import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Search, Save, History } from "lucide-react";
import { toast } from "sonner";

export default function Diagnostico() {
  const [machines, setMachines] = useState([]);
  const [defects, setDefects] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [q, setQ] = useState("");
  const [machine, setMachine] = useState(null);
  const [selectedDefectIds, setSelectedDefectIds] = useState([]);
  const [form, setForm] = useState({ diagnostico: "", causa: "", consequencia: "", recomendacao: "", status: "A1" });
  const [filterStatus, setFilterStatus] = useState("todos");
  const [showHistory, setShowHistory] = useState(false);
  const [historyQ, setHistoryQ] = useState("");

  const load = async () => {
    const [m, d, diag] = await Promise.all([api.get("/machines"), api.get("/defects"), api.get("/diagnostics")]);
    setMachines(m.data);
    setDefects(d.data);
    setDiagnostics(diag.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const diagMap = new Set(diagnostics.map((d) => d.machine_id));
    return machines.filter((m) => {
      if (filterStatus === "diagnosticados" && !diagMap.has(m.id)) return false;
      if (filterStatus === "pendentes" && diagMap.has(m.id)) return false;
      if (filterStatus !== "todos" && filterStatus !== "diagnosticados" && filterStatus !== "pendentes" && m.status !== filterStatus) return false;
      if (!q) return true;
      return [m.tag, m.equipamento, m.local].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()));
    });
  }, [machines, q, filterStatus, diagnostics]);

  const diagnostMachineIds = new Set(diagnostics.map((d) => d.machine_id));
  const totalDiagnosticados = machines.filter((m) => diagnostMachineIds.has(m.id)).length;
  const pendentes = machines.length - totalDiagnosticados;

  const toggleDefect = (id) => {
    setSelectedDefectIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Auto-fill from selected defects
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
    if (!machine) return;
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
          <h2 className="font-display text-2xl font-bold text-slate-900">Diagnóstico Inteligente</h2>
          <p className="text-sm text-slate-500">{totalDiagnosticados}/{machines.length} diagnosticados — {pendentes} pendentes</p>
        </div>
        <button data-testid="toggle-history-btn" onClick={() => setShowHistory(!showHistory)} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2">
          <History size={14} /> {showHistory ? "Voltar" : "Banco de Diagnósticos"}
        </button>
      </div>

      {showHistory ? (
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
      ) : !machine ? (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input data-testid="diag-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar máquina por TAG ou nome..." className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
            </div>
            <select data-testid="diag-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
              <option value="todos">Todos</option>
              <option value="pendentes">Pendentes de diagnóstico</option>
              <option value="diagnosticados">Já diagnosticados</option>
              <option value="OK">Status OK</option>
              <option value="A1">Status A1</option>
              <option value="A2">Status A2</option>
              <option value="Parado">Parado</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((m) => {
              const isDiag = diagnostMachineIds.has(m.id);
              return (
                <button
                  key={m.id}
                  data-testid={`diag-card-${m.tag}`}
                  onClick={() => setMachine(m)}
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
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Col 1: Defects */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">1. Marque os Defeitos</div>
            <div className="space-y-1.5 max-h-[60vh] overflow-auto">
              {defects.map((d) => (
                <label key={d.id} data-testid={`defect-check-${d.id}`} className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedDefectIds.includes(d.id)} onChange={() => toggleDefect(d.id)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">{d.nome} <StatusBadge status={d.alarme} /></div>
                    <div className="text-[11px] text-slate-500">{d.categoria}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Col 2: Auto-filled */}
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
              {[
                ["diagnostico", "Diagnóstico"], ["causa", "Causa"], ["consequencia", "Consequência"], ["recomendacao", "Recomendação"],
              ].map(([k, lab]) => (
                <div key={k}>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{lab} (auto)</label>
                  <textarea data-testid={`diag-auto-${k}`} value={form[k]} readOnly rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-md text-sm text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          {/* Col 3: Edit & save */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">3. Edite e Salve</div>
            <div className="space-y-3">
              {[
                ["diagnostico", "Diagnóstico final"], ["causa", "Causa"], ["consequencia", "Consequência"], ["recomendacao", "Recomendação"],
              ].map(([k, lab]) => (
                <div key={k}>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{lab}</label>
                  <textarea data-testid={`diag-edit-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              ))}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Novo Status da Máquina</label>
                <select data-testid="diag-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["OK", "A1", "A2", "Parado"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <button data-testid="save-diag-btn" onClick={save} className="w-full h-10 bg-slate-900 text-white rounded-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800">
                <Save size={14} /> Salvar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
