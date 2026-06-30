import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Plus, Search, Upload, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyMachine = {
  tag: "", local: "", equipamento: "", descricao: "", fabricante: "",
  rpm: "", potencia: "", rolamento_loa: "", rolamento_la: "",
  criticidade: "Média", status: "OK", tipo: "vibracao", componente: "",
};

export default function Maquinas() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (tipo) params.append("tipo", tipo);
    const { data } = await api.get(`/machines?${params}`);
    setItems(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, tipo]);

  const save = async () => {
    const payload = { ...editing, rpm: editing.rpm ? parseFloat(editing.rpm) : null, potencia: editing.potencia ? parseFloat(editing.potencia) : null };
    try {
      if (editing.id) await api.put(`/machines/${editing.id}`, payload);
      else await api.post("/machines", payload);
      toast.success("Salvo");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro");
    }
  };

  const del = async (m) => {
    if (!confirm(`Excluir ${m.tag}?`)) return;
    await api.delete(`/machines/${m.id}`);
    toast.success("Excluído");
    load();
  };

  const uploadFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    toast.message("Importando...");
    const { data } = await api.post("/machines/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success(`Importado: ${data.inserted} (puladas: ${data.skipped})`);
    fileRef.current.value = "";
    load();
  };

  return (
    <div className="space-y-4" data-testid="maquinas-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Cadastro de Máquinas</h2>
          <p className="text-sm text-slate-500">{items.length} máquinas listadas</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={uploadFile} className="hidden" data-testid="machine-file-input" />
          <button data-testid="import-machines-btn" onClick={() => fileRef.current?.click()} className="h-9 px-3 text-sm bg-white border border-slate-300 rounded-md flex items-center gap-2 hover:bg-slate-50">
            <Upload size={14} /> Importar Excel
          </button>
          <button data-testid="new-machine-btn" onClick={() => setEditing({ ...emptyMachine })} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2 hover:bg-slate-800">
            <Plus size={14} /> Nova Máquina
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="machine-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por TAG, equipamento, local..."
            className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm bg-white"
          />
        </div>
        <select data-testid="filter-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 px-3 border border-slate-300 rounded-md text-sm bg-white">
          <option value="todos">Todos os tipos</option>
          <option value="vibracao">Vibração</option>
          <option value="termografia">Termografia</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="fs-table">
            <thead className="sticky top-0">
              <tr>
                <th>TAG</th>
                <th>Local</th>
                <th>Equipamento</th>
                <th>Descrição</th>
                <th>RPM</th>
                <th>Pot. (cv)</th>
                <th>Criticidade</th>
                <th>Status</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} data-testid={`machine-row-${m.tag}`}>
                  <td className="font-mono font-semibold">{m.tag}</td>
                  <td className="text-xs">{m.local}</td>
                  <td>{m.equipamento}</td>
                  <td className="text-xs">{m.descricao}</td>
                  <td className="font-mono">{m.rpm || "-"}</td>
                  <td className="font-mono">{m.potencia || "-"}</td>
                  <td>{m.criticidade}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td className="text-xs uppercase">{m.tipo}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(m)} className="p-1 hover:bg-slate-200 rounded text-slate-600"><Edit2 size={14} /></button>
                      <button onClick={() => del(m)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={10} className="text-center text-slate-500 py-8">Nenhuma máquina encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="font-display font-bold text-lg mb-4">{editing.id ? "Editar" : "Nova"} Máquina</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["tag", "TAG *"], ["local", "Local"], ["equipamento", "Equipamento"], ["descricao", "Descrição"],
                ["fabricante", "Fabricante"], ["rpm", "RPM"], ["potencia", "Potência (cv)"],
                ["rolamento_loa", "Rolamento LOA"], ["rolamento_la", "Rolamento LA"], ["componente", "Componente"],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs uppercase font-semibold text-slate-600">{label}</label>
                  <input
                    data-testid={`machine-field-${k}`}
                    value={editing[k] ?? ""}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                    className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Criticidade</label>
                <select value={editing.criticidade} onChange={(e) => setEditing({ ...editing, criticidade: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["Alta", "Média", "Baixa"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Status</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["OK", "A1", "A2", "Parado"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Tipo</label>
                <select value={editing.tipo} onChange={(e) => setEditing({ ...editing, tipo: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["vibracao", "termografia", "ambos"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-3 h-9 text-sm border border-slate-300 rounded-md">Cancelar</button>
              <button data-testid="save-machine-btn" onClick={save} className="px-4 h-9 text-sm bg-slate-900 text-white rounded-md">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
