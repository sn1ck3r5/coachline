"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { User } from "@coachline/shared";

const GRADE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Not set" },
  { value: 0, label: "Kindergarten" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Grade ${i + 1}` })),
];

export default function ProfilePage() {
  const { user, signOut, deleteAccount } = useAuth();
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    api
      .get<User>("/users/me")
      .then((u) => setFullUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayUser = fullUser ?? user;

  const handleEnroll = async () => {
    setEnrolling(true);
    setEnrollError("");
    try {
      await api.post("/voice/enroll");
      const updated = await api.get<User>("/users/me");
      setFullUser(updated);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  const handleGradeChange = async (raw: string) => {
    setSavingGrade(true);
    try {
      const value = raw === "null" ? null : parseInt(raw, 10);
      const updated = await api.patch<User>("/users/me", { targetGrade: value });
      setFullUser(updated);
    } finally {
      setSavingGrade(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccount();
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account settings</p>
      </div>

      {/* User info */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
          Account Info
        </h2>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl font-bold text-violet-400">
            {displayUser?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-white">{displayUser?.name ?? "—"}</p>
            <p className="text-sm text-gray-400">{displayUser?.email ?? "—"}</p>
            <p className="text-xs text-gray-600 mt-0.5 capitalize">
              {displayUser?.role ?? "teacher"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#111] rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-0.5">Member since</p>
            <p className="text-white">
              {displayUser?.createdAt
                ? new Date(displayUser.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div className="bg-[#111] rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-0.5">Role</p>
            <p className="text-white capitalize">{displayUser?.role ?? "teacher"}</p>
          </div>
        </div>
      </div>

      {/* Teaching preferences */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
          Teaching Preferences
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Used to calibrate lesson-level analytics (e.g. vocabulary grade level).
        </p>
        <label className="block text-sm text-gray-400 mb-2">
          Primary grade level
        </label>
        <select
          value={
            displayUser?.targetGrade === null ||
            displayUser?.targetGrade === undefined
              ? "null"
              : String(displayUser.targetGrade)
          }
          onChange={(e) => handleGradeChange(e.target.value)}
          disabled={savingGrade}
          className="w-full sm:w-64 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
        >
          {GRADE_OPTIONS.map((opt) => (
            <option
              key={opt.value === null ? "null" : String(opt.value)}
              value={opt.value === null ? "null" : String(opt.value)}
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Voice enrollment */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Voice Enrollment
        </h2>

        {displayUser?.voiceEnrollmentUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <div>
              <p className="text-sm text-white">Voice profile enrolled</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Used for speaker identification in transcripts
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-gray-600 rounded-full" />
              <div>
                <p className="text-sm text-white">Not enrolled</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enroll your voice for accurate teacher/student separation
                </p>
              </div>
            </div>
            {enrollError && (
              <p className="text-xs text-red-400 mb-3">{enrollError}</p>
            )}
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              {enrolling ? "Starting enrollment…" : "Enroll Voice"}
            </button>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Session
        </h2>
        <button
          onClick={signOut}
          className="px-4 py-2 rounded-lg bg-[#111] border border-white/10 hover:border-white/20 text-sm text-white transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-red-500/20">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">
          Danger Zone
        </h2>

        {!confirmDelete ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Delete account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanently delete your account and all data
              </p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-sm text-red-400 transition-colors"
            >
              Delete account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-400">
              This action is irreversible. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full bg-[#111] border border-red-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteInput("");
                }}
                className="px-4 py-2 rounded-lg bg-[#111] border border-white/10 text-sm text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== "DELETE" || deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
