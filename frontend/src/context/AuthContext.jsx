import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('carepoint-token')));

  useEffect(() => {
    if (!sessionStorage.getItem('carepoint-token')) return;
    api.get('/auth/me').then(({ data }) => setUser(data)).catch(() => {
      sessionStorage.removeItem('carepoint-token');
    }).finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      sessionStorage.setItem('carepoint-token', data.token);
      setUser(data.user);
      return data.user;
    },
    async register(details) {
      await api.post('/auth/register', details);
      const { data } = await api.post('/auth/login', { email: details.email, password: details.password });
      sessionStorage.setItem('carepoint-token', data.token);
      setUser(data.user);
      return data.user;
    },
    logout() {
      sessionStorage.removeItem('carepoint-token');
      setUser(null);
    },
    refresh: async () => {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
