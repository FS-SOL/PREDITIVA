import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Building2, Plus, Trash2, LogIn, Users, Cog } from "lucide-react";
import { toast } from "sonner";

export default function Clientes() {
  const { setTenantId, tenantId } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", admin_name: "", admin_email: "", admin_password: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/tenants");
      setTenants(data);
    } catch (e) {
      toast.error("Erro ao carregar clientes");
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.admin_email || !form.admin_password || !form.admin_name) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      await api.post("/tenants", form);
      toast.success("Cliente criado com administrador");
      setOpen(false);
      setForm({ name: "", admin_name: "", admin_email: "", admin_password: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao criar cliente");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Excluir o cliente "${t.name}" e TODOS os seus dados? Esta ação é irreversível.`)) return;
    try {
      await api.delete(`/tenants/${t.id}`);
      toast.success("Cliente excluído");
      if (tenantId === t.id) setTenantId("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao excluir");
    }
  };

  const enter = (t) => {
    setTenantId(t.id);
    toast.success(`Acessando ${t.name}`);
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <div className="space-y-4" data-testid="clientes-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2"><Building2 size={22} /> Clientes</h2>
          <p className="text-sm text-slate-500">{tenants.length} empresa(s) cadastrada(s) — cada uma com dados isolados</p>
        </div>
        <button data-testid="new-tenant-btn" onClick={() => setOpen(true)} className="h-9 px-3 text-sm bg-slate-900 text-white rounded-md flex items-center gap-2">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <div key={t.id} data-testid={`tenant-card-${t.id}`} className={`bg-white border rounded-lg p-4 ${tenantId === t.id ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200"}`}>
            <div className="flex items-start justify-between">
              <div className="font-display font-bold text-slate-900">{t.name}</div>
              {tenantId === t.id && <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Ativo</span>}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Cog size={13} /> {t.machines_count} máquinas</span>
              <span className="flex items-center gap-1"><Users size={13} /> {t.users_count} usuários</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button data-testid={`enter-tenant-${t.id}`} onClick={() => enter(t)} className="flex-1 h-8 text-xs bg-slate-900 text-white rounded-md flex items-center justify-center gap-1">
                <LogIn size={13} /> Acessar
              </button>
              <button data-testid={`delete-tenant-${t.id}`} onClick={() => remove(t)} className="h-8 px-2 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-display font-bold text-lg mb-4">Novo Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Nome da Empresa</label>
                <input data-testid="tenant-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Administrador da empresa (login inicial)</p>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Nome do Admin</label>
                <input data-testid="tenant-admin-name" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Email do Admin</label>
                <input data-testid="tenant-admin-email" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-slate-600">Senha do Admin</label>
                <input data-testid="tenant-admin-password" type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} className="mt-1 w-full h-9 px-3 border border-slate-300 rounded-md text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="px-3 h-9 text-sm border border-slate-300 rounded-md">Cancelar</button>
              <button data-testid="save-tenant-btn" disabled={saving} onClick={save} className="px-4 h-9 text-sm bg-slate-900 text-white rounded-md disabled:opacity-60">{saving ? "Criando..." : "Criar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
