import React, { useState } from "react";
import api from "../lib/api";
import { formatDate, formatDateTime } from "../lib/dates";
import StatusBadge from "../components/StatusBadge";
import { FileText, Printer, Download } from "lucide-react";

const COLORS = { OK: "#22C55E", A1: "#FACC15", A2: "#F97316", Parado: "#EF4444" };

export default function Relatorios() {
  const [type, setType] = useState("summary"); // summary | complete
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const { data } = await api.get(`/reports/${type}`);
    setData(data);
    setLoading(false);
  };

  const printReport = () => window.print();

  return (
    <div className="space-y-4" data-testid="relatorios-page">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText size={22} /> Relatórios para Cliente
          </h2>
          <p className="text-sm text-slate-500">Gere relatório resumido ou completo da operação</p>
        </div>
        <div className="flex gap-2">
          <select data-testid="report-type" value={type} onChange={(e) => setType(e.target.value)} className="h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
            <option value="summary">Resumido</option>
            <option value="complete">Completo</option>
          </select>
          <button data-testid="generate-report-btn" onClick={generate} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2">
            <Download size={14} /> Gerar
          </button>
          {data && (
            <button data-testid="print-report-btn" onClick={printReport} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2">
              <Printer size={14} /> Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-slate-500">Gerando...</div>}

      {data && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 print-area" data-testid="report-content">
          <header className="border-b border-slate-200 pb-4 mb-6">
            <div className="font-display text-2xl font-bold">FS SOLUÇÕES — PREDITIVA</div>
            <div className="text-amber-600 font-mono text-xs tracking-widest">
              {type === "summary" ? "RELATÓRIO RESUMIDO" : "RELATÓRIO COMPLETO"}
            </div>
            <div className="text-xs text-slate-500 mt-1">Gerado em: {formatDateTime(data.generated_at)}</div>
          </header>

          <section className="mb-8">
            <h3 className="font-display font-bold text-lg mb-3">Indicadores Gerais (Dashboard)</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Máquinas</div><div className="font-display text-2xl font-bold">{data.total_machines}</div></div>
              <div className="border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Índice de Saúde</div><div className="font-display text-2xl font-bold">{data.health_index}%</div></div>
              <div className="border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Diagnósticos</div><div className="font-display text-2xl font-bold">{data.total_diagnostics}</div></div>
              <div className="border border-slate-200 rounded p-3"><div className="text-xs text-slate-500">Críticas (A2+Parado)</div><div className="font-display text-2xl font-bold">{(data.status_dist.A2 || 0) + (data.status_dist.Parado || 0)}</div></div>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="font-display font-bold text-lg mb-3">Distribuição de Status</h3>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(data.status_dist).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 border border-slate-200 rounded px-3 py-2">
                  <span className="w-3 h-3 rounded" style={{ background: COLORS[k] }} />
                  <span className="text-sm font-medium">{k}</span>
                  <span className="font-mono font-bold">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {data.top_defects?.length > 0 && (
            <section className="mb-8">
              <h3 className="font-display font-bold text-lg mb-3">Principais Defeitos</h3>
              <table className="fs-table">
                <thead><tr><th>Defeito</th><th className="text-right">Ocorrências</th></tr></thead>
                <tbody>
                  {data.top_defects.map((d) => (
                    <tr key={d.nome}><td>{d.nome}</td><td className="text-right font-mono font-semibold">{d.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.critical_machines?.length > 0 && (
            <section className="mb-8">
              <h3 className="font-display font-bold text-lg mb-3">Máquinas Críticas (A2 + Parado)</h3>
              <table className="fs-table">
                <thead><tr><th>TAG</th><th>Equipamento</th><th>Local</th><th>Status</th></tr></thead>
                <tbody>
                  {data.critical_machines.map((m) => (
                    <tr key={m.tag}><td className="font-mono font-semibold">{m.tag}</td><td>{m.equipamento}</td><td className="text-xs">{m.local}</td><td><StatusBadge status={m.status} /></td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {type === "complete" && data.diagnostics?.length > 0 && (
            <section className="mb-8">
              <h3 className="font-display font-bold text-lg mb-3">Diagnósticos Detalhados</h3>
              <div className="space-y-3">
                {data.diagnostics.map((d) => (
                  <div key={d.id} className="border border-slate-200 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-mono font-bold">{d.machine_tag} — {d.equipamento}</div>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="text-xs text-slate-500 mb-1">{formatDate(d.data)} — Técnico: {d.tecnico}</div>
                    <div className="text-sm"><b>Diagnóstico:</b> {d.diagnostico}</div>
                    {d.causa && <div className="text-xs"><b>Causa:</b> {d.causa}</div>}
                    {d.consequencia && <div className="text-xs"><b>Consequência:</b> {d.consequencia}</div>}
                    {d.recomendacao && <div className="text-xs"><b>Recomendação:</b> {d.recomendacao}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="border-t border-slate-200 pt-3 mt-6 text-xs text-slate-500 text-center">
            FS Soluções — Manutenção Preditiva · Documento gerado automaticamente
          </footer>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
          .no-print { display: none !important; }
          aside, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
