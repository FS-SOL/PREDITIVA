import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Search, Flame } from "lucide-react";

export default function Termografia() {
  const [machines, setMachines] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/machines?tipo=termografia");
      setMachines(data);
    })();
  }, []);

  const filtered = useMemo(
    () => machines.filter((m) => !q || [m.tag, m.equipamento, m.local, m.componente].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))),
    [machines, q]
  );

  return (
    <div className="space-y-4" data-testid="termografia-page">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Termografia</h2>
        <p className="text-sm text-slate-500">{filtered.length} pontos de inspeção termográfica</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar TAG/quadro..." className="w-full max-w-md h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((m) => (
          <div key={m.id} data-testid={`termo-card-${m.tag}`} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-orange-500" />
                <div className="font-mono font-bold text-sm">{m.tag}</div>
              </div>
              <StatusBadge status={m.status} />
            </div>
            <div className="text-xs text-slate-600">{m.equipamento}</div>
            <div className="text-xs text-slate-400">{m.local}</div>
            {m.componente && <div className="text-[11px] text-slate-500 mt-1">Componente: {m.componente}</div>}
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-slate-500 text-sm p-6 text-center">Nenhum ponto cadastrado.</div>}
      </div>
    </div>
  );
}
