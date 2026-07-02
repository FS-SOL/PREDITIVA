import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Plantas from "./pages/Plantas";
import Maquinas from "./pages/Maquinas";
import Vibracao from "./pages/Vibracao";
import Termografia from "./pages/Termografia";
import BibliotecaDefeitos from "./pages/BibliotecaDefeitos";
import Diagnostico from "./pages/Diagnostico";
import Usuarios from "./pages/Usuarios";
import Relatorios from "./pages/Relatorios";
import Auditoria from "./pages/Auditoria";
import Manual from "./pages/Manual";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/plantas" element={<Plantas />} />
            <Route path="/maquinas" element={<Maquinas />} />
            <Route path="/vibracao" element={<Vibracao />} />
            <Route path="/termografia" element={<Termografia />} />
            <Route path="/defeitos" element={<BibliotecaDefeitos />} />
            <Route path="/diagnostico" element={<Diagnostico />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
