import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, getAccessToken, clearTokens } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  // Fetch updated profile
  const refreshProfile = useCallback(async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
      return userData;
    } catch (error) {
      if (error.response?.status === 401) {
        clearTokens();
        setUser(null);
      }
      throw error;
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          await refreshProfile();
        } catch {
          setUser(null);
        }
      } else {
        // Attempt silent cookie-based session restoration on browser refresh
        try {
          await authService.refreshToken();
          await refreshProfile();
        } catch {
          // No active cookie session or refresh failed
          setUser(null);
        }
      }
      setLoading(false);
    };

    initSession();

    // Listen for global auth failure events from axios interceptor
    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('nutricore:auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('nutricore:auth:unauthorized', handleUnauthorized);
    };
  }, [refreshProfile]);

  // Login handler
  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setUser(data.user);
    return data;
  };

  // Register handler
  const register = async (registerData) => {
    const data = await authService.register(registerData);
    setUser(data.user);
    return data;
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: !!(user?.is_superuser),
    loading,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
