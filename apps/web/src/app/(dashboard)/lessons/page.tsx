"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { LessonReport } from "@coachline/shared";

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(ms: number) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export default function LessonsPage() {
  const [reports, setReports] = useState<LessonReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ reports: LessonReport[]; total: number }>(
        `/reports?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`
      )
      .then((res) => {
        setReports(res.reports ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setReports([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Lessons</h1>
          <p className="text-gray-400 text-sm mt-1">{total} recordings total</p>
        </div>
        <Link
          href="/record"
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
        >
          + New Recording
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-[#1a1a1a] rounded-xl p-12 border border-white/5 text-center">
          <p className="text-gray-400 mb-4">No lessons recorded yet</p>
          <Link
            href="/record"
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Record your first lesson
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/lessons/${report.id}`}
                className="block bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-white/10 hover:scale-[1.005] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-white">
                        Lesson — {formatDate(report.createdAt)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
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
                    {report.status === "completed" && report.summary && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>
                          {formatDuration(report.summary.totalDurationMs ?? 0)}
                        </span>
                        <span>
                          Teacher:{" "}
                          <span className="text-gray-300">
                            {report.summary.talkTime?.teacherPercent ?? 0}%
                          </span>
                        </span>
                        <span>
                          Student:{" "}
                          <span className="text-gray-300">
                            {report.summary.talkTime?.studentPercent ?? 0}%
                          </span>
                        </span>
                        <span>
                          Questions:{" "}
                          <span className="text-gray-300">
                            {report.summary.questions?.total ?? 0}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-600 flex-shrink-0 ml-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
