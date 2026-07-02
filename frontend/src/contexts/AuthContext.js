import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [tenantId, setTenantIdState] = useState(localStorage.getItem("fs_tenant") || "");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("fs_token", data.token);
    // Non-super-admins are always scoped to their own tenant — clear any stale selection
    if (data.role !== "superadmin") {
      localStorage.removeItem("fs_tenant");
      setTenantIdState("");
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* noop */ }
    localStorage.removeItem("fs_token");
    localStorage.removeItem("fs_tenant");
    setTenantIdState("");
    setUser(null);
  };

  const setTenantId = (id) => {
    if (id) localStorage.setItem("fs_tenant", id);
    else localStorage.removeItem("fs_tenant");
    setTenantIdState(id || "");
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, setUser, tenantId, setTenantId }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
