import { useEffect, useState, useCallback } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthContext, type AuthState } from "../lib/auth";
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from "../lib/storage";
import { api } from "../lib/api";
import type { User } from "@coachline/shared";

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        const me = await api.get<User>("/users/me");
        setUser(me);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      if (!user.voiceEnrollmentUrl) {
        router.replace("/(auth)/voice-enrollment");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [user, segments, isLoading]);

  const authState: AuthState = {
    user,
    isLoading,
    signIn: async (email, password) => {
      const result = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/login", { email, password });
      await setAccessToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      setUser(result.user);
    },
    signUp: async (email, password, name) => {
      const result = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/signup", { email, password, name });
      await setAccessToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      setUser(result.user);
    },
    signOut: async () => {
      await api.delete("/auth/logout");
      await clearTokens();
      setUser(null);
    },
    checkAuth,
  };

  return (
    <AuthContext.Provider value={authState}>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthContext.Provider>
  );
}
