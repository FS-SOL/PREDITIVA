import React, { useEffect, useState } from "react";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Plus, Edit2, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const empty = {
  nome: "", categoria: "mecanico", sintomas: "", frequencias: "", causas: "",
  consequencias: "", acoes: "", diagnostico: "", recomendacao: "", alarme: "A1", ativo: true,
};

export default function BibliotecaDefeitos() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/defects");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (editing.id) await api.put(`/defects/${editing.id}`, editing);
      else await api.post("/defects", editing);
      toast.success("Salvo");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro");
    }
  };

  const del = async (d) => {
    if (!confirm(`Excluir "${d.nome}"?`)) return;
    await api.delete(`/defects/${d.id}`);
    toast.success("Excluído");
    load();
  };

  return (
    <div className="space-y-4" data-testid="defeitos-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen size={22} /> Biblioteca de Defeitos
          </h2>
          <p className="text-sm text-slate-500">{items.length} defeitos catalogados</p>
        </div>
        <button data-testid="new-defect-btn" onClick={() => setEditing({ ...empty })} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2">
          <Plus size={14} /> Novo Defeito
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((d) => (
          <div key={d.id} data-testid={`defect-card-${d.id}`} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2 gap-2">
              <h3 className="font-display font-bold text-slate-900 text-sm leading-tight">{d.nome}</h3>
              <StatusBadge status={d.alarme} />
            </div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-slate-500 mb-2">{d.categoria}</div>
            <div className="text-xs text-slate-600 space-y-1 flex-1">
              {d.sintomas && <div><b>Sintomas:</b> {d.sintomas}</div>}
              {d.frequencias && <div><b>Freq.:</b> {d.frequencias}</div>}
              {d.causas && <div><b>Causas:</b> {d.causas}</div>}
            </div>
            <div className="flex gap-1 mt-3 justify-end">
              <button onClick={() => setEditing(d)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><Edit2 size={14} /></button>
              <button onClick={() => del(d)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="font-display font-bold text-lg mb-4">{editing.id ? "Editar" : "Novo"} Defeito</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold text-slate-600">Nome *</label>
                <input data-testid="defect-field-nome" value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Categoria</label>
                <select value={editing.categoria} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["mecanico", "eletrico", "rolamento", "lubrificacao", "hidraulico", "termografia"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Alarme</label>
                <select data-testid="defect-field-alarme" value={editing.alarme} onChange={(e) => setEditing({ ...editing, alarme: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  {["OK", "A1", "A2", "Parado"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              {[
                ["sintomas", "Sintomas"], ["frequencias", "Frequências"], ["causas", "Causas"],
                ["consequencias", "Consequências"], ["acoes", "Ações"], ["diagnostico", "Diagnóstico padrão"], ["recomendacao", "Recomendação padrão"],
              ].map(([k, lab]) => (
                <div key={k} className="col-span-2">
                  <label className="text-xs uppercase font-semibold text-slate-600">{lab}</label>
                  <textarea value={editing[k] || ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="px-3 h-9 text-sm border border-slate-300 rounded-md">Cancelar</button>
              <button data-testid="save-defect-btn" onClick={save} className="px-4 h-9 text-sm bg-slate-900 text-white rounded-md">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
