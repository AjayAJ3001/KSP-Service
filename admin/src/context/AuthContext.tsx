import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/adminService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ksp_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('ksp_admin_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('ksp_admin_token');
      if (savedToken) {
        try {
          const res = await authService.getMe();
          setUser(res.data);
          localStorage.setItem('ksp_admin_user', JSON.stringify(res.data));
        } catch (err) {
          localStorage.removeItem('ksp_admin_token');
          localStorage.removeItem('ksp_admin_user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authService.login(username, password);
    if (res.data.user.role !== 'ADMIN') {
      throw new Error('Access denied. Administrator privileges required.');
    }
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('ksp_admin_token', res.data.token);
    localStorage.setItem('ksp_admin_user', JSON.stringify(res.data.user));
  };

  const logout = async () => {
    try {
      if (token) await authService.logout();
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('ksp_admin_token');
      localStorage.removeItem('ksp_admin_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      setUser(res.data);
      localStorage.setItem('ksp_admin_user', JSON.stringify(res.data));
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
