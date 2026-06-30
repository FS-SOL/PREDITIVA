import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../lib/dates";
import StatusBadge from "../components/StatusBadge";
import { Search, Flame, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Termografia() {
  const { user } = useAuth();
  const canEdit = user?.role !== "visualizador";
  const [machines, setMachines] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [q, setQ] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    const { data } = await api.get("/machines?tipo=termografia");
    setMachines(data);
    const { data: d } = await api.get("/diagnostics");
    setDiagnostics(d);
  };
  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    toast.message("Importando lista de termografia...");
    try {
      const { data } = await api.post(`/machines/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Importados ${data.inserted} pontos${data.skipped ? ` (${data.skipped} já existentes)` : ""}`);
      load();
    } catch (err) {
      toast.error("Falha ao importar. Verifique se a planilha tem uma aba com 'TERMO' no nome.");
    }
    fileRef.current.value = "";
  };

  const filtered = useMemo(
    () => machines.filter((m) => !q || [m.tag, m.equipamento, m.local, m.componente].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))),
    [machines, q]
  );

  return (
    <div className="space-y-4" data-testid="termografia-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Termografia</h2>
          <p className="text-sm text-slate-500">{filtered.length} pontos de inspeção termográfica</p>
        </div>
        <div className="flex gap-2">
          {canEdit && <>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={upload} className="hidden" data-testid="termo-file-input" />
            <button data-testid="import-termo-btn" onClick={() => fileRef.current?.click()} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2 hover:bg-slate-800">
              <Upload size={14} /> Importar Lista
            </button>
          </>}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar TAG/quadro..." className="w-full max-w-md h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((m) => {
          const mDiags = diagnostics.filter((d) => d.machine_id === m.id);
          const isDiag = mDiags.length > 0;
          const last = isDiag ? mDiags.sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] : null;
          const displayStatus = isDiag ? m.status : "Sem diag.";
          return (
            <div key={m.id} data-testid={`termo-card-${m.tag}`} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Flame size={14} className="text-orange-500 shrink-0" />
                  <div className="font-mono font-bold text-sm truncate">{m.tag}</div>
                </div>
                <StatusBadge status={displayStatus} />
              </div>
              <div className="text-xs text-slate-600 truncate">{m.equipamento}</div>
              <div className="text-xs text-slate-400 truncate">{m.local}</div>
              {m.componente && <div className="text-[11px] text-slate-500 mt-1">Componente: {m.componente}</div>}
              <div className="mt-2 text-[11px]">
                {last ? <span className="font-mono text-emerald-700">Últ. diag: {formatDate(last.data)}</span> : <span className="text-slate-400 italic">Sem diagnóstico</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-slate-500 text-sm p-6 text-center">Nenhum ponto cadastrado. Use "Importar Lista".</div>}
      </div>
    </div>
  );
}
