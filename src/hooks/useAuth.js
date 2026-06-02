import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hub_token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(res => setUser(res.user))
      .catch(() => { localStorage.removeItem('hub_token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('hub_token', res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('hub_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
