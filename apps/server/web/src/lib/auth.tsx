"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type { User } from "@coachline/shared";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("coachline_access_token");
    if (!token) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await api.get<User>("/users/me");
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      localStorage.removeItem("coachline_access_token");
      localStorage.removeItem("coachline_refresh_token");
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem("coachline_access_token", accessToken);
    localStorage.setItem("coachline_refresh_token", refreshToken);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/login",
        { email, password }
      );
      setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user, isLoading: false, isAuthenticated: true });
    },
    [setTokens]
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/register",
        { name, email, password }
      );
      setTokens(data.accessToken, data.refreshToken);
      setState({ user: data.user, isLoading: false, isAuthenticated: true });
    },
    [setTokens]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem("coachline_access_token");
    localStorage.removeItem("coachline_refresh_token");
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = "/login";
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.delete("/users/me");
    localStorage.removeItem("coachline_access_token");
    localStorage.removeItem("coachline_refresh_token");
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = "/login";
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    setTokens,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
