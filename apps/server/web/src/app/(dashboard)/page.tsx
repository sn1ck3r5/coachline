"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Goal, LessonReport } from "@coachline/shared";

interface DashboardData {
  goals: Goal[];
  reports: LessonReport[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all hover:scale-[1.01]">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(ms: number) {
  const min = Math.round(ms / 60000);
  return `${min} min`;
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [goalsRes, reportsRes] = await Promise.all([
          api.get<{ goals: Goal[] }>("/goals?status=active&limit=1"),
          api.get<{ reports: LessonReport[]; total: number }>("/reports?limit=5"),
        ]);
        setData({ goals: goalsRes.goals ?? [], reports: reportsRes.reports ?? [] });
      } catch {
        setData({ goals: [], reports: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeGoal = data?.goals[0] ?? null;
  const recentReports = data?.reports ?? [];
  const totalLessons = recentReports.length;
  const avgTeacherTalk =
    recentReports.length > 0
      ? Math.round(
          recentReports.reduce((s, r) => s + (r.summary?.talkTime?.teacherPercent ?? 0), 0) /
            recentReports.length
        )
      : 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Here&apos;s your teaching overview</p>
        </div>
        <Link
          href="/record"
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          New Recording
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Lessons recorded" value={totalLessons} />
            <StatCard label="Avg teacher talk" value={`${avgTeacherTalk}%`} sub="lower is better" />
            <StatCard label="Active goal" value={activeGoal ? "1" : "0"} />
            <StatCard
              label="Practice area"
              value={activeGoal ? activeGoal.practiceArea.replace(/_/g, " ") : "—"}
            />
          </div>

          {/* Active goal */}
          {activeGoal ? (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Active Goal
                </h2>
                <Link
                  href={`/goals/${activeGoal.id}`}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  View progress →
                </Link>
              </div>
              <p className="text-lg font-semibold text-white capitalize">
                {activeGoal.customLabel ?? activeGoal.practiceArea.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Target: {activeGoal.targetMetric}
              </p>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-dashed border-white/10 mb-6 flex items-center justify-between">
              <p className="text-gray-400 text-sm">No active goal set</p>
              <Link
                href="/goals"
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30 transition-colors"
              >
                Set a goal
              </Link>
            </div>
          )}

          {/* Recent lessons */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Recent Lessons
              </h2>
              <Link
                href="/lessons"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View all →
              </Link>
            </div>

            {recentReports.length === 0 ? (
              <div className="bg-[#1a1a1a] rounded-xl p-8 border border-white/5 text-center">
                <p className="text-gray-400 text-sm mb-3">No lessons recorded yet</p>
                <Link
                  href="/record"
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  Record your first lesson
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => router.push(`/lessons/${report.id}`)}
                    className="w-full bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-white/10 hover:scale-[1.01] transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Lesson — {formatDate(report.createdAt)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDuration(report.summary?.totalDurationMs ?? 0)} •{" "}
                          {report.summary?.talkTime?.teacherPercent ?? 0}% teacher talk
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          report.status === "completed"
                            ? "bg-green-500/10 text-green-400"
                            : report.status === "processing"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
