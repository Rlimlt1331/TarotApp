import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { API_URL } from '../config/api';

export interface User {
  id: number;
  email: string | null;
  name: string | null;
  role: 'requester' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  gemBalance: number;
  freeReadingUsed: boolean;
  hasPendingPurchase: boolean;
  refreshGems: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithTelegramToken: (telegramToken: string) => Promise<void>;
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
  const [gemBalance, setGemBalance] = useState(0);
  const [freeReadingUsed, setFreeReadingUsed] = useState(false);
  const [hasPendingPurchase, setHasPendingPurchase] = useState(false);

  const refreshGems = useCallback(async () => {
    const tok = localStorage.getItem('tarot_token');
    if (!tok) return;
    try {
      const res = await fetch(`${API_URL}/gems/balance`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGemBalance(data.gemBalance ?? 0);
        setFreeReadingUsed(data.freeReadingUsed ?? false);
        setHasPendingPurchase(data.hasPendingPurchase ?? false);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const applySession = (userData: User, tok: string) => {
    setUser(userData);
    setToken(tok);
    localStorage.setItem('tarot_token', tok);
  };

  const verifyToken = async (tok: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${tok}` },
      });

      if (response.ok) {
        const data = await parseApiResponse(response);
        applySession(data.user, tok);
        // Load gem balance after session is established
        try {
          const gemsRes = await fetch(`${API_URL}/gems/balance`, {
            headers: { Authorization: `Bearer ${tok}` },
          });
          if (gemsRes.ok) {
            const gemsData = await gemsRes.json();
            setGemBalance(gemsData.gemBalance ?? 0);
            setFreeReadingUsed(gemsData.freeReadingUsed ?? false);
          }
        } catch { /* non-fatal */ }
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

  // On mount: check for ?tg_login= param first, then fall back to stored token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tgLoginToken = params.get('tg_login');

    if (tgLoginToken) {
      // Remove the token from URL before doing anything else
      params.delete('tg_login');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      fetch(`${API_URL}/auth/telegram-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgLoginToken }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            applySession(data.user, data.token);
            try {
              const gemsRes = await fetch(`${API_URL}/gems/balance`, {
                headers: { Authorization: `Bearer ${data.token}` },
              });
              if (gemsRes.ok) {
                const gemsData = await gemsRes.json();
                setGemBalance(gemsData.gemBalance ?? 0);
                setFreeReadingUsed(gemsData.freeReadingUsed ?? false);
                setHasPendingPurchase(gemsData.hasPendingPurchase ?? false);
              }
            } catch { /* non-fatal */ }
          } else {
            console.warn('Telegram login token invalid or expired');
            const storedToken = localStorage.getItem('tarot_token');
            if (storedToken) await verifyToken(storedToken);
          }
        })
        .catch(() => {
          const storedToken = localStorage.getItem('tarot_token');
          if (storedToken) verifyToken(storedToken);
        })
        .finally(() => setLoading(false));
    } else {
      const storedToken = localStorage.getItem('tarot_token');
      if (storedToken) {
        verifyToken(storedToken);
      } else {
        setLoading(false);
      }
    }
  }, []);

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
      applySession(data.user, data.token);
      await refreshGems();
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithTelegramToken = async (telegramToken: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/telegram-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken }),
      });
      if (!response.ok) {
        const errorData = await parseApiResponse(response);
        throw new Error(errorData.error || 'Telegram login failed');
      }
      const data = await parseApiResponse(response);
      applySession(data.user, data.token);
      await refreshGems();
    } catch (error: any) {
      console.error('Telegram login error:', error);
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
      applySession(data.user, data.token);
      setGemBalance(0);
      setFreeReadingUsed(false);
      setHasPendingPurchase(false);
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
    setGemBalance(0);
    setFreeReadingUsed(false);
    setHasPendingPurchase(false);
    localStorage.removeItem('tarot_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        gemBalance,
        freeReadingUsed,
        hasPendingPurchase,
        refreshGems,
        login,
        loginWithTelegramToken,
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
