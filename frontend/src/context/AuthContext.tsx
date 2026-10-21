import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, StudentProfile, LoginResponse } from '../types';
import { authService } from '../services';
import { apiClient } from '../services/api';

interface AuthContextType {
  user: User | null;
  profile: StudentProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (identifierOrEmail: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<void>;
  dismissPasswordChange: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cat_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cat_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [profile, setProfile] = useState<StudentProfile | null>(() => {
    const saved = localStorage.getItem('cat_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const savedToken = localStorage.getItem('cat_token');
    if (!savedToken) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await authService.getMe();
      const userProfile =
        data.user?.profile || (data.user as any)?.student_profile || data.profile || null;

      setUser(data.user);
      setProfile(userProfile);
      localStorage.setItem('cat_user', JSON.stringify(data.user));
      if (userProfile) {
        localStorage.setItem('cat_profile', JSON.stringify(userProfile));
      } else {
        localStorage.removeItem('cat_profile');
      }
    } catch (err: any) {
      // Hanya bersihkan sesi jika server secara eksplisit menolak kredensial (401),
      // hindari logout mendadak saat ada gangguan jaringan sementara
      if (err?.response?.status === 401 || err?.status === 401) {
        localStorage.removeItem('cat_token');
        localStorage.removeItem('cat_user');
        localStorage.removeItem('cat_profile');
        setToken(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Sinkronisasi status autentikasi antar tab browser
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cat_token') {
        if (!e.newValue) {
          setToken(null);
          setUser(null);
          setProfile(null);
        } else {
          setToken(e.newValue);
          refreshProfile();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshProfile]);

  const login = async (identifierOrEmail: string, password: string): Promise<LoginResponse> => {
    const res = await authService.login(identifierOrEmail, password);
    localStorage.setItem('cat_token', res.token);
    setToken(res.token);
    apiClient.defaults.headers.common.Authorization = `Bearer ${res.token}`;

    // Format user object
    const authUser: User = {
      id: res.user.id,
      email: res.user.email,
      role: res.user.role,
      status: 'active',
      must_change_password: res.user.must_change_password,
      created_at: new Date().toISOString(),
    };

    setUser(authUser);
    localStorage.setItem('cat_user', JSON.stringify(authUser));

    const userProfile =
      res.user.student_profile || (res.user as any)?.profile || null;

    if (userProfile) {
      setProfile(userProfile);
      localStorage.setItem('cat_profile', JSON.stringify(userProfile));
    } else {
      setProfile(null);
      localStorage.removeItem('cat_profile');
    }

    setIsLoading(false);
    return res;
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      delete apiClient.defaults.headers.common.Authorization;
      localStorage.removeItem('cat_token');
      localStorage.removeItem('cat_user');
      localStorage.removeItem('cat_profile');
      setToken(null);
      setUser(null);
      setProfile(null);
    }
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<void> => {
    await authService.changePassword(oldPass, newPass);
    if (user) {
      const updatedUser = { ...user, must_change_password: false };
      setUser(updatedUser);
      localStorage.setItem('cat_user', JSON.stringify(updatedUser));
    }
  };

  const dismissPasswordChange = async (): Promise<void> => {
    await authService.dismissPasswordChange();
    if (user) {
      const updatedUser = { ...user, must_change_password: false };
      setUser(updatedUser);
      localStorage.setItem('cat_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        mustChangePassword: Boolean(user?.must_change_password),
        login,
        logout,
        changePassword,
        dismissPasswordChange,
        refreshProfile,
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
