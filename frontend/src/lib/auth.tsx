import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "./api";

export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type AuthResponse = { token: string; user: User };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(path: string, body: unknown) {
    const { token, user } = await api<AuthResponse>(path, {
      method: "POST",
      body,
    });
    setToken(token);
    setUser(user);
  }

  const value: AuthContextValue = {
    user,
    loading,
    login: (email, password) =>
      authenticate("/api/auth/login", { email, password }),
    register: (email, password, name) =>
      authenticate("/api/auth/register", { email, password, name }),
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
