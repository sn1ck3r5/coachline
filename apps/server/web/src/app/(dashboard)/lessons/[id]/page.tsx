"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type {
  LessonReport,
  LessonRecording,
  Transcript,
  TranscriptSegment,
} from "@coachline/shared";

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

function DistributionBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white tabular-nums">{value}</span>
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

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  science: "Science",
  social_studies: "Social Studies",
  other: "Other",
};

const INTENT_LABELS: Record<string, string> = {
  direct_instruction: "Direct Instruction",
  discussion: "Discussion",
  inquiry: "Inquiry",
  workshop: "Workshop",
  review: "Review",
  collaborative: "Collaborative",
  assessment: "Assessment",
};

function gradeLabel(grade: number | null): string {
  if (grade === null) return "—";
  if (grade === 0) return "Kindergarten";
  return `Grade ${grade}`;
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
          {(report.summary?.subject || report.summary?.topic) && (
            <p className="text-gray-500 text-xs mt-1">
              {report.summary?.subject
                ? SUBJECT_LABELS[report.summary.subject] ?? report.summary.subject
                : null}
              {report.summary?.subject && report.summary?.topic ? " · " : null}
              {report.summary?.topic ?? null}
            </p>
          )}
          {(report as LessonReport & { recording?: { intent: string | null } }).recording?.intent && (
            <p className="text-xs mt-2">
              <span className="inline-block px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                Intent:{" "}
                {INTENT_LABELS[
                  (report as LessonReport & { recording: { intent: string } }).recording.intent
                ] ?? (report as LessonReport & { recording: { intent: string } }).recording.intent}
              </span>
            </p>
          )}
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

          {/* Question Depth — Webb's DOK distribution */}
          {q?.dok && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Question Depth
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Webb's Depth of Knowledge — higher levels require more reasoning.
              </p>
              {(() => {
                const d = q.dok;
                const max = Math.max(d.level1, d.level2, d.level3, d.level4, d.unclassified, 1);
                return (
                  <div className="space-y-3">
                    <DistributionBar label="1 · Recall" value={d.level1} max={max} color="bg-violet-400/70" />
                    <DistributionBar label="2 · Skill/Concept" value={d.level2} max={max} color="bg-violet-500" />
                    <DistributionBar label="3 · Strategic" value={d.level3} max={max} color="bg-indigo-500" />
                    <DistributionBar label="4 · Extended" value={d.level4} max={max} color="bg-blue-500" />
                    {d.unclassified > 0 && (
                      <DistributionBar label="Unclassified" value={d.unclassified} max={max} color="bg-gray-600" />
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Praise — specific vs general, ratio to correction */}
          {report.summary?.praise && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Praise &amp; Correction
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Specific praise (references a behavior or answer) tends to drive learning
                more than general affirmations.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge label="Specific praise" value={report.summary.praise.specific} />
                <StatBadge label="General praise" value={report.summary.praise.general} />
                <StatBadge label="Corrections" value={report.summary.praise.correction} />
                <StatBadge
                  label="Praise : Correction"
                  value={
                    report.summary.praise.praiseToCorrectionRatio !== null
                      ? report.summary.praise.praiseToCorrectionRatio.toFixed(1)
                      : "—"
                  }
                />
              </div>
            </div>
          )}

          {/* Teacher Moves — distribution of what the teacher was doing */}
          {report.summary?.teacherMoves && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Teacher Moves
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Distribution across the types of teacher talk in this lesson.
              </p>
              {(() => {
                const m = report.summary!.teacherMoves;
                const max = Math.max(m.instruct, m.explain, m.question, m.feedback, m.manage, 1);
                return (
                  <div className="space-y-3">
                    <DistributionBar label="Explain" value={m.explain} max={max} color="bg-violet-500" />
                    <DistributionBar label="Question" value={m.question} max={max} color="bg-indigo-500" />
                    <DistributionBar label="Instruct" value={m.instruct} max={max} color="bg-blue-500" />
                    <DistributionBar label="Feedback" value={m.feedback} max={max} color="bg-cyan-500" />
                    <DistributionBar label="Manage" value={m.manage} max={max} color="bg-gray-500" />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Vocabulary — Flesch-Kincaid vs teacher's target grade */}
          {report.summary?.vocabGradeLevel && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Vocabulary
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Teacher talk readability (Flesch–Kincaid grade level) vs your target grade.
              </p>
              {(() => {
                const v = report.summary!.vocabGradeLevel;
                if (v.teacherFleschKincaid === null) {
                  return (
                    <p className="text-sm text-gray-400">
                      Not enough teacher speech in this lesson to compute a readability
                      score.
                    </p>
                  );
                }
                const delta = v.deltaVsTarget;
                const deltaColor =
                  delta === null
                    ? "text-gray-400"
                    : Math.abs(delta) <= 1
                      ? "text-green-400"
                      : delta > 1
                        ? "text-amber-400"
                        : "text-rose-400";
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatBadge
                      label="Teacher FK grade"
                      value={v.teacherFleschKincaid.toFixed(1)}
                    />
                    <StatBadge
                      label="Target grade"
                      value={gradeLabel(v.targetGrade)}
                    />
                    <div className="bg-[#111] rounded-lg p-3 text-center">
                      <p className={`text-lg font-bold tabular-nums ${deltaColor}`}>
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {delta === null ? "Set target grade in profile" : "vs target"}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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

          {/* One Next Move — the single highest-leverage change for next lesson */}
          {report.summary?.nextMove && (
            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 rounded-xl p-5 border border-violet-500/30">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-sm font-semibold text-violet-300 uppercase tracking-wider">
                  Try This Next Lesson
                </h2>
              </div>
              <p className="text-lg font-semibold text-white leading-snug">
                {report.summary.nextMove.title}
              </p>
              <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                {report.summary.nextMove.description}
              </p>
              <p className="text-xs text-gray-500 italic mt-3 leading-relaxed">
                Why it works: {report.summary.nextMove.whyItWorks}
              </p>
              {report.summary.nextMove.rehearsalScript && (
                <div className="mt-4 p-3 rounded-lg bg-black/30 border border-violet-500/20">
                  <p className="text-xs text-violet-300 uppercase tracking-wider mb-1 font-semibold">
                    Rehearse saying
                  </p>
                  <p className="text-sm text-gray-200 italic leading-relaxed">
                    &ldquo;{report.summary.nextMove.rehearsalScript}&rdquo;
                  </p>
                </div>
              )}
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
