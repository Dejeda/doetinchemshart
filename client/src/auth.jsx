import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const u = await api.post('/api/auth/login', { username, password });
    setUser(u);
    return u;
  }

  async function logout() {
    try { await api.post('/api/auth/logout'); } catch {}
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
