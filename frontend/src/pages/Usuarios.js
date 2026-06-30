import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

export default function Usuarios() {
  const { register } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "tecnico" });

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/auth/register", form);
      toast.success("Usuário criado");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "tecnico" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro");
    }
  };

  return (
    <div className="space-y-4" data-testid="usuarios-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><UsersIcon size={22} /> Usuários</h2>
          <p className="text-sm text-slate-500">{users.length} cadastrados</p>
        </div>
        <button data-testid="new-user-btn" onClick={() => setOpen(true)} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2">
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="fs-table">
          <thead><tr><th>Nome</th><th>Email</th><th>Função</th><th>Criado em</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.email}`}>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td><span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-100">{u.role}</span></td>
                <td className="text-xs font-mono text-slate-500">{(u.created_at || "").slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-display font-bold text-lg mb-4">Novo Usuário</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Nome</label>
                <input data-testid="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Email</label>
                <input data-testid="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Senha</label>
                <input data-testid="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Função</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-white">
                  <option value="tecnico">Técnico</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="px-3 h-9 text-sm border border-slate-300 rounded-md">Cancelar</button>
              <button data-testid="save-user-btn" onClick={save} className="px-4 h-9 text-sm bg-slate-900 text-white rounded-md">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
