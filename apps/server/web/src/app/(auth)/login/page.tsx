"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Coachline
          </h1>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-8 border border-white/10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="you@school.edu"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-4">
            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              className="mt-4 w-full py-2.5 rounded-lg bg-[#111] border border-white/10 hover:border-white/20 text-white font-medium transition-colors flex items-center justify-center gap-2"
              onClick={() => alert("Google OAuth coming soon")}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-violet-400 hover:text-violet-300 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
