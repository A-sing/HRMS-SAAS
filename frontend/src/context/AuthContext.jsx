import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { TOKEN_KEY } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, object = user
  const [company, setCompany] = useState(null);

  const loadCompany = useCallback(async () => {
    try {
      const { data } = await api.get("/company");
      setCompany(data);
    } catch (e) { /* ignore */ }
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setUser(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      loadCompany();
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(false);
    }
  }, [loadCompany]);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) { return; }
    checkAuth();
  }, [checkAuth]);

  const applyAuth = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    loadCompany();
  }, [loadCompany]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
    setCompany(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, company, loadCompany, applyAuth, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
