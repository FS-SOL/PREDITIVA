import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

const NEXT_TYPE = { empresa: "unidade", unidade: "area", area: "equipamento", equipamento: "subconjunto", subconjunto: "ponto", ponto: null };

const typeColor = (t) => ({
  empresa: "bg-slate-900 text-white",
  unidade: "bg-blue-100 text-blue-800",
  area: "bg-purple-100 text-purple-800",
  equipamento: "bg-amber-100 text-amber-800",
  subconjunto: "bg-emerald-100 text-emerald-800",
  ponto: "bg-rose-100 text-rose-800",
}[t] || "bg-slate-100");

export default function Plantas() {
  const [nodes, setNodes] = useState([]);
  const [adding, setAdding] = useState(null);
  const [name, setName] = useState("");
  const [openMap, setOpenMap] = useState({});

  const load = async () => {
    const { data } = await api.get("/plants");
    setNodes(data);
  };
  useEffect(() => { load(); }, []);

  const childrenMap = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      const k = n.parent_id || "_root";
      m[k] = m[k] || [];
      m[k].push(n);
    });
    return m;
  }, [nodes]);

  // Flatten with depth using iterative traversal (avoids recursive component)
  const visibleRows = useMemo(() => {
    const rows = [];
    const walk = (parentId, depth) => {
      const kids = childrenMap[parentId] || [];
      kids.forEach((node) => {
        rows.push({ node, depth });
        const isOpen = openMap[node.id] ?? depth < 2;
        if (isOpen) walk(node.id, depth + 1);
      });
    };
    walk("_root", 0);
    return rows;
  }, [childrenMap, openMap]);

  const toggleOpen = (id, defaultOpen) => {
    setOpenMap((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultOpen) }));
  };

  const onAdd = (parent) => {
    setAdding({ parent, type: NEXT_TYPE[parent.type] });
    setName("");
  };
  const onEdit = async (node) => {
    // eslint-disable-next-line no-alert
    const newName = window.prompt("Novo nome:", node.name);
    if (!newName) return;
    await api.put(`/plants/${node.id}`, { ...node, name: newName });
    toast.success("Atualizado");
    load();
  };
  const onDelete = async (node) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Excluir "${node.name}"?`)) return;
    await api.delete(`/plants/${node.id}`);
    toast.success("Excluído");
    load();
  };
  const save = async () => {
    if (!name.trim()) return;
    await api.post("/plants", { name, type: adding.type, parent_id: adding.parent.id });
    setAdding(null);
    toast.success("Criado");
    load();
  };

  return (
    <div className="space-y-4" data-testid="plantas-page">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">Hierarquia de Plantas</h2>
        <p className="text-sm text-slate-500">Empresa → Unidade → Área → Equipamento → Subconjunto → Ponto</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-3">
        {visibleRows.length === 0 && <div className="text-slate-500 text-sm p-4">Nenhuma planta cadastrada.</div>}
        {visibleRows.map(({ node, depth }) => {
          const kids = childrenMap[node.id] || [];
          const isOpen = openMap[node.id] ?? depth < 2;
          return (
            <div
              key={node.id}
              data-testid={`plant-node-${node.id}`}
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-md group text-sm"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <button onClick={() => toggleOpen(node.id, depth < 2)} className="w-4 text-slate-500">
                {kids.length > 0 ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
              </button>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded font-mono ${typeColor(node.type)}`}>{node.type}</span>
              <span className="font-medium text-slate-900">{node.name}</span>
              <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                {NEXT_TYPE[node.type] && (
                  <button
                    data-testid={`add-child-${node.id}`}
                    onClick={() => onAdd(node)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    title="Adicionar filho"
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button onClick={() => onEdit(node)} className="p-1 hover:bg-slate-200 rounded text-slate-600">
                  <Edit2 size={14} />
                </button>
                {node.type !== "empresa" && (
                  <button onClick={() => onDelete(node)} className="p-1 hover:bg-red-100 rounded text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="font-semibold text-lg mb-3">Adicionar {adding.type}</h3>
            <p className="text-xs text-slate-500 mb-3">Em: {adding.parent.name}</p>
            <input
              autoFocus
              data-testid="plant-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAdding(null)} className="px-3 h-9 text-sm rounded-md border border-slate-300">Cancelar</button>
              <button data-testid="plant-save-btn" onClick={save} className="px-3 h-9 text-sm rounded-md bg-slate-900 text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
