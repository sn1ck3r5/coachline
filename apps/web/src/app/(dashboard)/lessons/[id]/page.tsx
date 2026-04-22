"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LessonReport, Transcript, TranscriptSegment } from "@coachline/shared";

function TalkTimeBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white">{percent}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#111] rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function SegmentBubble({
  segment,
  isPlaying,
  onPlay,
}: {
  segment: TranscriptSegment;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const isTeacher = segment.speaker === "teacher";
  return (
    <div className={`flex gap-3 ${isTeacher ? "" : "flex-row-reverse"}`}>
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
          isTeacher ? "bg-violet-600 text-white" : "bg-indigo-600 text-white"
        }`}
      >
        {isTeacher ? "T" : "S"}
      </div>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 border cursor-pointer transition-all ${
          isTeacher
            ? "bg-violet-600/10 border-violet-500/20 hover:border-violet-500/40"
            : "bg-[#1a1a1a] border-white/5 hover:border-white/15"
        } ${isPlaying ? "ring-1 ring-violet-500" : ""}`}
        onClick={onPlay}
      >
        <p className="text-sm text-white leading-relaxed">{segment.text}</p>
        <p className="text-xs text-gray-600 mt-1">
          {Math.floor(segment.startMs / 1000)}s — {Math.floor(segment.endMs / 1000)}s
        </p>
      </div>
    </div>
  );
}

export default function LessonReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<LessonReport | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rep, trans] = await Promise.all([
          api.get<LessonReport>(`/reports/${params.id}`),
          api.get<Transcript>(`/reports/${params.id}/transcript`).catch(() => null),
        ]);
        setReport(rep);
        setTranscript(trans);
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error || "Report not found"}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-violet-400 hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  const tt = report.summary?.talkTime;
  const q = report.summary?.questions;
  const wt = report.summary?.waitTime;
  const totalDuration = report.summary?.totalDurationMs ?? 0;
  const minutes = Math.floor(totalDuration / 60000);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
          <h1 className="text-2xl font-bold text-white">Lesson Report</h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date(report.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {minutes} minutes
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
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

      {report.status !== "completed" && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-400 text-sm">
          This report is still {report.status}. Full analytics will be available when processing is
          complete.
        </div>
      )}

      {report.status === "completed" && (
        <>
          {/* Talk time */}
          {tt && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Talk Time
              </h2>
              <div className="space-y-3">
                <TalkTimeBar label="Teacher" percent={tt.teacherPercent} color="bg-violet-500" />
                <TalkTimeBar label="Student" percent={tt.studentPercent} color="bg-indigo-400" />
                <TalkTimeBar label="Group" percent={tt.groupPercent} color="bg-blue-400" />
                <TalkTimeBar label="Silence" percent={tt.silencePercent} color="bg-gray-600" />
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBadge label="Total Questions" value={q?.total ?? 0} />
              <StatBadge label="Open-ended" value={q?.openEnded ?? 0} />
              <StatBadge label="Wait Time 1 avg" value={`${Math.round((wt?.waitTime1AvgMs ?? 0) / 1000)}s`} />
              <StatBadge label="Uptake moments" value={report.summary?.uptakeCount ?? 0} />
              <StatBadge label="Long student talk" value={report.summary?.longStudentTalkCount ?? 0} />
              <StatBadge label="Student questions" value={report.summary?.studentQuestionCount ?? 0} />
              <StatBadge label="Closed questions" value={q?.closed ?? 0} />
              <StatBadge label="Wait Time 2 avg" value={`${Math.round((wt?.waitTime2AvgMs ?? 0) / 1000)}s`} />
            </div>
          </div>

          {/* Highlighted moments */}
          {report.highlightedMoments?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Highlighted Moments
              </h2>
              <div className="space-y-3">
                {report.highlightedMoments.map((moment, i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-3 rounded-lg bg-[#111] border border-white/5"
                  >
                    <div className="w-1.5 bg-violet-500 rounded-full flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{moment.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{moment.description}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {Math.floor(moment.startMs / 1000)}s – {Math.floor(moment.endMs / 1000)}s
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reflection prompts */}
          {report.reflectionPrompts?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Reflection Prompts
              </h2>
              <ul className="space-y-3">
                {report.reflectionPrompts.map((prompt, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300">
                    <span className="text-violet-400 font-bold flex-shrink-0">{i + 1}.</span>
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {transcript && transcript.segments?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Transcript
              </h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {transcript.segments.map((seg, i) => (
                  <SegmentBubble
                    key={i}
                    segment={seg}
                    isPlaying={activeSegment === i}
                    onPlay={() => {
                      setActiveSegment(i);
                      // Seek audio if available
                      if (audioRef.current) {
                        audioRef.current.currentTime = seg.startMs / 1000;
                        audioRef.current.play();
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
