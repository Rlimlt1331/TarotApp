import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { API_URL } from '../config/api';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'requester' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();

  if (contentType.includes('application/json') && responseText) {
    return JSON.parse(responseText);
  }

  if (responseText) {
    throw new Error(responseText);
  }

  throw new Error('API returned an empty response');
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stored token and verify on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('tarot_token');
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tok: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${tok}` },
      });

      if (response.ok) {
        const data = await parseApiResponse(response);
        setUser(data.user);
        setToken(tok);
      } else {
        localStorage.removeItem('tarot_token');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('tarot_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await parseApiResponse(response);
        throw new Error(errorData.error || `Login failed (${response.status})`);
      }

      const data = await parseApiResponse(response);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('tarot_token', data.token);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await parseApiResponse(response);
        throw new Error(errorData.error || `Signup failed (${response.status})`);
      }

      const data = await parseApiResponse(response);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('tarot_token', data.token);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tarot_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
