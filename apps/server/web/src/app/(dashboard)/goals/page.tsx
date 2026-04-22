"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Goal } from "@coachline/shared";
import { PRACTICE_AREAS } from "@coachline/shared";

const AREA_LABELS: Record<string, string> = {
  wait_time: "Wait Time",
  open_questions: "Open Questions",
  student_talk_ratio: "Student Talk Ratio",
  uptake: "Uptake",
  custom: "Custom",
};

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block bg-[#1a1a1a] rounded-xl p-5 border border-white/5 hover:border-white/10 hover:scale-[1.01] transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {goal.customLabel ?? AREA_LABELS[goal.practiceArea] ?? goal.practiceArea}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Target: {goal.targetMetric}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Started {new Date(goal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            goal.status === "active"
              ? "bg-green-500/10 text-green-400"
              : goal.status === "completed"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {goal.status}
        </span>
      </div>
    </Link>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // New goal form state
  const [practiceArea, setPracticeArea] = useState<string>(PRACTICE_AREAS[0]);
  const [targetMetric, setTargetMetric] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadGoals = async () => {
    try {
      const res = await api.get<{ goals: Goal[] }>("/goals");
      setGoals(res.goals ?? []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMetric.trim()) {
      setFormError("Target metric is required");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await api.post("/goals", {
        practiceArea,
        targetMetric,
        customLabel: practiceArea === "custom" ? customLabel : undefined,
      });
      setShowForm(false);
      setTargetMetric("");
      setCustomLabel("");
      setPracticeArea(PRACTICE_AREAS[0]);
      await loadGoals();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSubmitting(false);
    }
  };

  const active = goals.filter((g) => g.status === "active");
  const others = goals.filter((g) => g.status !== "active");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <p className="text-gray-400 text-sm mt-1">Track your teaching improvement areas</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
        >
          {showForm ? "Cancel" : "+ New Goal"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-violet-500/30 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            New Goal
          </h2>
          {formError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Practice Area</label>
              <select
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                {PRACTICE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {AREA_LABELS[area] ?? area}
                  </option>
                ))}
              </select>
            </div>

            {practiceArea === "custom" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Label</label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Reduce filler words"
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Metric</label>
              <input
                type="text"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                required
                placeholder="e.g. &lt; 60% teacher talk, ≥ 5 open questions"
                className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {submitting ? "Creating…" : "Create Goal"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-[#1a1a1a] rounded-xl p-12 border border-white/5 text-center">
          <p className="text-gray-400 mb-4">No goals set yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Create your first goal
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Active</h2>
              <div className="space-y-3">
                {active.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                Completed / Paused
              </h2>
              <div className="space-y-3">
                {others.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
