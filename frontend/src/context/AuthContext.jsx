import { useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import axiosInstance from '../api/axiosInstance';
import { AuthContext } from './authContext';

const clearAuthStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

const isAccessTokenValid = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const getStoredUser = () => {
  const storedUser = localStorage.getItem('user');
  const token = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');

  if (!storedUser || !token) return null;

  if (isAccessTokenValid(token) || refreshToken) {
    return JSON.parse(storedUser);
  }

  clearAuthStorage();
  return null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

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
      console.error('Failed to revoke token on server:', error);
    } finally {
      clearAuthStorage();
      setUser(null);
    }
  };

  const updateUser = (updatedData) => {
    const newData = { ...user, ...updatedData };
    localStorage.setItem('user', JSON.stringify(newData));
    setUser(newData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
