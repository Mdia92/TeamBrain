"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { configureApiAuth, type User } from "@/app/lib/api";
import * as authApi from "@/app/lib/auth-api";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);
  const router = useRouter();

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* clear local anyway */
    }
    accessTokenRef.current = null;
    setUser(null);
    router.push("/login");
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    accessTokenRef.current = result.access_token;
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(
    async (data: {
      email: string;
      password: string;
      full_name: string;
      organization_name: string;
    }) => {
      const result = await authApi.signup(data);
      accessTokenRef.current = result.access_token;
      setUser(result.user);
      return result.user;
    },
    [],
  );

  useEffect(() => {
    configureApiAuth({
      getToken: () => accessTokenRef.current,
      setToken: setAccessToken,
      onAuthFailure: () => {
        accessTokenRef.current = null;
        setUser(null);
      },
    });

    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
          accessTokenRef.current = urlToken;
          const profile = await authApi.me(urlToken);
          if (!cancelled) setUser(profile);
          setIsLoading(false);
          return;
        }
        const refreshed = await authApi.refresh();
        if (!refreshed) return;
        accessTokenRef.current = refreshed.access_token;
        const profile = await authApi.me();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) {
          accessTokenRef.current = null;
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAccessToken]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
