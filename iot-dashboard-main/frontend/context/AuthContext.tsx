'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { apiPost } from '@/lib/api';

export type Role = 'user' | 'operator';
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  isOperator: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('iot_token');
    if (saved) {
      try {
        const decoded = jwtDecode<AuthUser & { exp: number }>(saved);
        if (decoded.exp * 1000 > Date.now()) {
          setToken(saved);
          setUser({ id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role });
        } else {
          localStorage.removeItem('iot_token');
        }
      } catch {
        localStorage.removeItem('iot_token');
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const data = await apiPost('/api/auth/login', { email, password });
    localStorage.setItem('iot_token', data.token);
    setToken(data.token);
    setUser(data.user);
    router.push('/dashboard');
  }

  function logout() {
    localStorage.removeItem('iot_token');
    setToken(null);
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, token, isOperator: user?.role === 'operator', loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
