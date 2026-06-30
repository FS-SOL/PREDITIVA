import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { formatDate } from "../lib/dates";
import StatusBadge from "../components/StatusBadge";
import { Upload, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Vibracao() {
  const [machines, setMachines] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
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

  const filtered = useMemo(
    () => machines.filter((m) =>
      !q || [m.tag, m.equipamento, m.local, m.descricao].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))
    ),
    [machines, q]
  );

  const trend = useMemo(() => {
    if (!selected) return [];
    return measurements
      .filter((m) => m.machine_id === selected.id)
      .map((m, i) => ({ idx: i + 1, valor: m.valor, ponto: m.ponto, data: formatDate(m.data) }));
  }, [selected, measurements]);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    toast.message("Importando medidas...");
    const { data } = await api.post(`/measurements/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success(`Importadas ${data.inserted} medidas`);
    fileRef.current.value = "";
    load();
  };

  return (
    <div className="space-y-4" data-testid="vibracao-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Análise de Vibração</h2>
          <p className="text-sm text-slate-500">{filtered.length} máquinas com monitoramento de vibração</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={upload} className="hidden" data-testid="meas-file-input" />
          <button data-testid="import-meas-btn" onClick={() => fileRef.current?.click()} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2 hover:bg-slate-50">
            <Upload size={14} /> Importar Overall
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar máquina..." className="w-full max-w-md h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((m) => {
          const has = measurements.filter((x) => x.machine_id === m.id).length;
          const machineDiags = diagnostics.filter((d) => d.machine_id === m.id);
          const isDiag = machineDiags.length > 0;
          const last = isDiag ? machineDiags.sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] : null;
          const displayStatus = isDiag ? m.status : "Sem diag.";
          return (
            <button
              key={m.id}
              data-testid={`vibracao-card-${m.tag}`}
              onClick={() => setSelected(m)}
              className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-slate-900 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="font-mono font-bold text-sm truncate">{m.tag}</div>
                <StatusBadge status={displayStatus} />
              </div>
              <div className="text-xs text-slate-600 truncate">{m.equipamento}</div>
              <div className="text-xs text-slate-400 truncate">{m.local}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-mono">{m.rpm || "-"} RPM</span>
                <span className="font-mono">{has} medidas</span>
              </div>
              <div className="mt-1 text-[11px]">
                {last ? <span className="font-mono text-emerald-700">Últ. diag: {formatDate(last.data)}</span> : <span className="text-slate-400 italic">Sem diagnóstico</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
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

            <h4 className="font-semibold flex items-center gap-2 mb-2"><TrendingUp size={16}/> Linha de Tendência</h4>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="valor" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded">Importe medidas para gerar a tendência.</div>
            )}

            {trend.length > 0 && (
              <div className="mt-4 overflow-auto max-h-[200px]">
                <table className="fs-table">
                  <thead><tr><th>#</th><th>Ponto</th><th>Valor</th><th>Data</th></tr></thead>
                  <tbody>
                    {trend.map((t, i) => (
                      <tr key={i}><td className="font-mono">{t.idx}</td><td>{t.ponto}</td><td className="font-mono">{t.valor}</td><td>{t.data}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
