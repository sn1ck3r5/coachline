"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const token = searchParams.get("token");

    if (!code && !token) {
      setError("Missing authentication parameters");
      return;
    }

    (async () => {
      try {
        let data: { accessToken: string; refreshToken: string };
        if (code) {
          data = await api.post<{ accessToken: string; refreshToken: string }>("/auth/callback", {
            code,
          });
        } else {
          data = await api.post<{ accessToken: string; refreshToken: string }>(
            "/auth/magic-link/verify",
            { token }
          );
        }
        setTokens(data.accessToken, data.refreshToken);
        router.replace("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    })();
  }, [searchParams, setTokens, router]);

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/login" className="text-violet-400 hover:underline">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-400">Completing sign-in…</p>
    </>
  );
}

export default function CallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <Suspense
          fallback={
            <>
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading…</p>
            </>
          }
        >
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
