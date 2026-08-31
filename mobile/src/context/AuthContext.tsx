import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { mobileAuthService } from '../services/mobileService';

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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('ksp_mobile_token');
      const storedUser = await AsyncStorage.getItem('ksp_mobile_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Verify with backend
        try {
          const res = await mobileAuthService.getMe();
          setUser(res.data);
          await AsyncStorage.setItem('ksp_mobile_user', JSON.stringify(res.data));
        } catch (e) {
          // Token expired or invalid
          await AsyncStorage.removeItem('ksp_mobile_token');
          await AsyncStorage.removeItem('ksp_mobile_user');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const res = await mobileAuthService.login(username, password);
    setToken(res.data.token);
    setUser(res.data.user);
    await AsyncStorage.setItem('ksp_mobile_token', res.data.token);
    await AsyncStorage.setItem('ksp_mobile_user', JSON.stringify(res.data.user));
  };

  const logout = async () => {
    try {
      await mobileAuthService.logout();
    } catch (e) {
      // ignore
    } finally {
      await AsyncStorage.removeItem('ksp_mobile_token');
      await AsyncStorage.removeItem('ksp_mobile_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await mobileAuthService.getMe();
      setUser(res.data);
      await AsyncStorage.setItem('ksp_mobile_user', JSON.stringify(res.data));
    } catch (e) {
      console.error('Error refreshing user', e);
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
