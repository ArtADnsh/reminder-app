import { createContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance'; // مطمئن شو این مسیر دقیقه

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');

      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (data) => {
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);

    const userData = {
      id: data.user_id,
      username: data.username,
      email: data.email,
    };

    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await axiosInstance.post('auth/logout/', { refresh });
      }
    } catch (error) {
      console.error("Failed to revoke token on server:", error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};