"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import type { Goal, GoalProgress } from "@coachline/shared";

const AREA_LABELS: Record<string, string> = {
  wait_time: "Wait Time",
  open_questions: "Open Questions",
  student_talk_ratio: "Student Talk Ratio",
  uptake: "Uptake",
  custom: "Custom",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  paused: "Paused",
};

interface ChartPoint {
  date: string;
  value: number;
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([
          api.get<Goal>(`/goals/${params.id}`),
          api.get<{ progress: GoalProgress[] }>(`/goals/${params.id}/progress`),
        ]);
        setGoal(g);
        setProgress(p.progress ?? []);
      } catch {
        setError("Failed to load goal");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const chartData: ChartPoint[] = progress.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: p.value,
  }));

  const handleStatusChange = async (newStatus: Goal["status"]) => {
    if (!goal) return;
    setUpdating(true);
    try {
      const updated = await api.patch<Goal>(`/goals/${params.id}`, { status: newStatus });
      setGoal(updated);
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error || "Goal not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-400 hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  const latestValue = progress.length > 0 ? progress[progress.length - 1].value : null;
  const firstValue = progress.length > 0 ? progress[0].value : null;
  const trend =
    latestValue !== null && firstValue !== null && progress.length > 1
      ? latestValue - firstValue
      : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {goal.customLabel ?? AREA_LABELS[goal.practiceArea] ?? goal.practiceArea}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Target: {goal.targetMetric}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            goal.status === "active"
              ? "bg-green-500/10 text-green-400"
              : goal.status === "completed"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {STATUS_LABELS[goal.status] ?? goal.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-bold text-white">{progress.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sessions tracked</p>
        </div>
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-bold text-white">
            {latestValue !== null ? latestValue.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Latest value</p>
        </div>
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p
            className={`text-2xl font-bold ${
              trend === null ? "text-white" : trend < 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Trend</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
          Progress Over Time
        </h2>
        {chartData.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
            Not enough data yet — complete more lessons to see a trend
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  cursor={{ stroke: "rgba(139,92,246,0.3)" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Status controls */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Update Status
        </h2>
        <div className="flex gap-3">
          {(["active", "paused", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={updating || goal.status === s}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                goal.status === s
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                  : "bg-[#111] border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
