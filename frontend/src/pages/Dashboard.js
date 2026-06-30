import React, { useEffect, useState } from "react";
import api from "../lib/api";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import StatusBadge from "../components/StatusBadge";
import { Activity, Heart, AlertTriangle, Cog } from "lucide-react";

const COLORS = { OK: "#22C55E", A1: "#FACC15", A2: "#F97316", Parado: "#EF4444" };

const Kpi = ({ icon: Icon, label, value, sub, color = "text-slate-900" }) => (
  <div className="kpi-card" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
    <div className="flex items-center justify-between">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <Icon size={18} className="text-slate-400" />
    </div>
    <div className={`mt-2 font-display text-3xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/dashboard");
      setD(data);
    })();
  }, []);

  if (!d) return <div className="text-slate-500">Carregando dashboard...</div>;

  const statusData = Object.entries(d.status_dist).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Dashboard Executivo</h2>
        <p className="text-sm text-slate-500">Visão geral da saúde dos ativos monitorados.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Cog} label="Máquinas" value={d.total_machines} sub="ativos monitorados" />
        <Kpi icon={Heart} label="Índice de Saúde" value={`${d.health_index}%`} color={d.health_index > 80 ? "text-green-600" : d.health_index > 60 ? "text-amber-600" : "text-red-600"} sub="média ponderada" />
        <Kpi icon={Activity} label="Diagnósticos" value={d.total_diagnostics} sub="emitidos" />
        <Kpi icon={AlertTriangle} label="Em Alerta" value={(d.status_dist.A1 || 0) + (d.status_dist.A2 || 0) + (d.status_dist.Parado || 0)} color="text-orange-600" sub="A1 + A2 + Parado" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="kpi-card lg:col-span-1">
          <h3 className="font-display font-semibold text-slate-900 mb-3">Distribuição de Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                {statusData.map((s) => (
                  <Cell key={s.name} fill={COLORS[s.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-sm" style={{ background: COLORS[s.name] }} />
                <span className="font-mono">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kpi-card lg:col-span-2">
          <h3 className="font-display font-semibold text-slate-900 mb-3">Evolução Mensal de Diagnósticos</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={d.monthly_evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="OK" stroke={COLORS.OK} strokeWidth={2} />
              <Line type="monotone" dataKey="A1" stroke={COLORS.A1} strokeWidth={2} />
              <Line type="monotone" dataKey="A2" stroke={COLORS.A2} strokeWidth={2} />
              <Line type="monotone" dataKey="Parado" stroke={COLORS.Parado} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="kpi-card">
          <h3 className="font-display font-semibold text-slate-900 mb-3">Principais Defeitos</h3>
          {d.top_defects.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhum diagnóstico registrado.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.top_defects} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F172A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="kpi-card" data-testid="failure-ranking">
          <h3 className="font-display font-semibold text-slate-900 mb-3">
            Probabilidade de Falha (Top 10)
          </h3>
          <div className="overflow-auto max-h-[260px]">
            <table className="fs-table">
              <thead>
                <tr>
                  <th>TAG</th>
                  <th>Equipamento</th>
                  <th>Status</th>
                  <th>Criticidade</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {d.failure_ranking.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono">{r.tag}</td>
                    <td>{r.equipamento}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.criticidade}</td>
                    <td className="text-right font-mono font-semibold">{r.score}</td>
                  </tr>
                ))}
                {d.failure_ranking.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-4">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
