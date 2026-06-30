import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("admin@fssolucoes.com");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("");
  const [role, setRole] = useState("tecnico");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Bem-vindo!");
      } else {
        await register({ email, password, name, role });
        toast.success("Usuário criado!");
      }
      navigate("/");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Falha na autenticação";
      setErr(typeof msg === "string" ? msg : "Erro de validação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-slate-900 items-end p-12 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1717386255773-a456c611dc4e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxwcmVkaWN0aXZlJTIwbWFpbnRlbmFuY2UlMjBtYWNoaW5lfGVufDB8fHx8MTc4Mjc4Mjg0OHww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="relative z-10 text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-400 text-slate-900 p-2 rounded">
              <Activity size={22} />
            </div>
            <div className="font-display text-2xl font-bold">FS SOLUÇÕES</div>
          </div>
          <div className="text-sm tracking-widest text-amber-400 font-mono mb-4">
            MANUTENÇÃO PREDITIVA
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight mb-3">
            Saúde dos seus ativos em tempo real.
          </h2>
          <p className="text-slate-300 text-sm">
            Vibração, termografia, biblioteca de defeitos e diagnósticos em um só lugar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === "login"
                ? "Acesse o sistema com seu e-mail."
                : "Cadastre um novo usuário do sistema."}
            </p>
          </div>

          {mode === "register" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Nome</label>
              <input
                data-testid="register-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full h-10 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</label>
            <input
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full h-10 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Senha</label>
            <input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full h-10 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Função</label>
              <select
                data-testid="register-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full h-10 px-3 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="tecnico">Técnico</option>
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          )}

          {err && <div className="text-sm text-red-600">{err}</div>}

          <button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          <button
            data-testid="toggle-auth-mode"
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
            className="text-xs text-slate-600 hover:text-slate-900 underline w-full text-center"
          >
            {mode === "login" ? "Não tem conta? Criar nova conta" : "Já tem conta? Entrar"}
          </button>

          <div className="text-[11px] text-slate-400 text-center pt-4 border-t border-slate-100">
            Credenciais padrão: admin@fssolucoes.com / admin123
          </div>
        </form>
      </div>
    </div>
  );
}
