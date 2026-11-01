import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";

interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: "Admin" | "Trabajador";
  jobTitle: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  registerWorker: (firstName: string, lastName: string, password: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("taskflow_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);

  const persist = (res: authApi.AuthResponse) => {
    localStorage.setItem("taskflow_token", res.token);
    const authUser: AuthUser = {
      userId: res.userId,
      email: res.email,
      displayName: res.displayName,
      role: res.role,
      jobTitle: res.jobTitle,
    };
    localStorage.setItem("taskflow_user", JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.role === "Admin",
      login: async (email, password) => {
        persist(await authApi.login(email, password));
      },
      register: async (email, password, displayName) => {
        persist(await authApi.register(email, password, displayName));
      },
      registerWorker: async (firstName, lastName, password) => {
        const authUser = persist(await authApi.registerWorker(firstName, lastName, password));
        return authUser.email;
      },
      logout: () => {
        localStorage.removeItem("taskflow_token");
        localStorage.removeItem("taskflow_user");
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
