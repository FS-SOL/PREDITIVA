import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach token from localStorage as well (fallback) + tenant scope for Super-Admin
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("fs_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  const tid = localStorage.getItem("fs_tenant");
  if (tid) cfg.headers["X-Tenant-Id"] = tid;
  return cfg;
});

export default api;
