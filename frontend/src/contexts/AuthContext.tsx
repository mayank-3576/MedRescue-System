import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  hospitalId?: string;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  updateCurrentUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseStoredUser = (savedUser: string | null): User | null => {
  if (!savedUser) return null;

  try {
    const parsed: unknown = JSON.parse(savedUser);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<User>;
    if (
      (typeof candidate.id !== 'string' && typeof candidate.id !== 'number') ||
      typeof candidate.email !== 'string' ||
      (candidate.role !== 'admin' && candidate.role !== 'staff')
    ) return null;

    return {
      ...candidate,
      id: String(candidate.id),
      username: typeof candidate.username === 'string' ? candidate.username : candidate.email,
      hospital_id: candidate.hospital_id == null ? undefined : String(candidate.hospital_id),
    } as User;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('medrescue_token');
      const savedUser = localStorage.getItem('medrescue_user');
      const parsedUser = parseStoredUser(savedUser);

      if (savedToken && parsedUser) {
        try {
          setToken(savedToken);
          setUser(parsedUser);
          // Verify with backend
          const freshUser = await authApi.getMe();
          setUser(freshUser);
          localStorage.setItem('medrescue_user', JSON.stringify(freshUser));
        } catch (e) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('medrescue_token');
          localStorage.removeItem('medrescue_user');
        }
      } else if (savedToken || savedUser) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('medrescue_token');
        localStorage.removeItem('medrescue_user');
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      setLoading(true);
      const data = await authApi.login(email, password);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('medrescue_token', data.token);
      localStorage.setItem('medrescue_user', JSON.stringify(data.user));
      toast.success(`Welcome back, ${data.user.full_name || data.user.username}!`);
      return data.user;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Authentication failed. Please check credentials.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('medrescue_token');
      localStorage.removeItem('medrescue_user');
      toast.success('Logged out successfully');
    }
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates };
      setUser(updated);
      localStorage.setItem('medrescue_user', JSON.stringify(updated));
    }
  };

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const hospitalId = user?.hospital_id;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        isStaff,
        hospitalId,
        login,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
