"use client";
import { useState } from "react";
import type { LessonReport, Transcript, TranscriptSegment } from "@coachline/shared";
import { EquityOfVoiceCard } from "./cards/EquityOfVoiceCard";
import { DialogueFlowCard } from "./cards/DialogueFlowCard";
import { StudentReasoningCard } from "./cards/StudentReasoningCard";
import { LessonLaunchCard } from "./cards/LessonLaunchCard";
import { QuestionQualityCard } from "./cards/QuestionQualityCard";
import { AcademicLanguageCard } from "./cards/AcademicLanguageCard";

function TalkTimeBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
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

function DistributionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SegmentBubble({ segment, isActive, onPlay }: { segment: TranscriptSegment; isActive: boolean; onPlay: () => void }) {
  const isTeacher = segment.speaker === "teacher";
  return (
    <div className={`flex gap-3 ${isTeacher ? "" : "flex-row-reverse"}`}>
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isTeacher ? "bg-violet-600" : "bg-indigo-600"} text-white`}>
        {isTeacher ? "T" : "S"}
      </div>
      <div
        onClick={onPlay}
        className={`max-w-[75%] rounded-xl px-3 py-2 border cursor-pointer transition-all ${isTeacher ? "bg-violet-600/10 border-violet-500/20 hover:border-violet-500/40" : "bg-[#1a1a1a] border-white/5 hover:border-white/15"} ${isActive ? "ring-1 ring-violet-500" : ""}`}
      >
        <p className="text-sm text-white leading-relaxed">{segment.text}</p>
        <p className="text-xs text-gray-600 mt-1">{Math.floor(segment.startMs / 1000)}s — {Math.floor(segment.endMs / 1000)}s</p>
      </div>
    </div>
  );
}

function gradeLabel(grade: number | null) {
  if (grade === null) return "—";
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

export function ReportZone3({
  report,
  transcript,
  activeSegment,
  onSegmentPlay,
}: {
  report: LessonReport;
  transcript: Transcript | null;
  activeSegment: number | null;
  onSegmentPlay: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = report.summary;
  const tt = s?.talkTime;
  const q = s?.questions;
  const wt = s?.waitTime;

  return (
    <div className="border border-dashed border-[#334155] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-slate-400">Full Analysis</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Talk time · Questions · Wait time · Uptake · Praise · Teacher moves · Vocab · 6 expanded cards
          </p>
        </div>
        <span className="text-slate-500 text-lg" style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>↓</span>
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-5 border-t border-[#1e293b]">
          {tt && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Talk Time</h3>
              <div className="space-y-3">
                <TalkTimeBar label="Teacher" percent={tt.teacherPercent} color="bg-violet-500" />
                <TalkTimeBar label="Student" percent={tt.studentPercent} color="bg-indigo-400" />
                <TalkTimeBar label="Group" percent={tt.groupPercent} color="bg-blue-400" />
                <TalkTimeBar label="Silence" percent={tt.silencePercent} color="bg-gray-600" />
              </div>
            </div>
          )}

          {q && wt && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge label="Total Questions" value={q.total} />
                <StatBadge label="Open-ended" value={q.openEnded} />
                <StatBadge label="Wait Time 1 avg" value={`${Math.round(wt.waitTime1AvgMs / 1000)}s`} />
                <StatBadge label="Uptake moments" value={s?.uptakeCount ?? 0} />
                <StatBadge label="Long student talk" value={s?.longStudentTalkCount ?? 0} />
                <StatBadge label="Closed questions" value={q.closed} />
                <StatBadge label="Wait Time 2 avg" value={`${Math.round(wt.waitTime2AvgMs / 1000)}s`} />
                <StatBadge label="Focusing questions" value={q.focusing} />
              </div>
            </div>
          )}

          {q?.dok && (() => {
            const d = q.dok;
            const max = Math.max(d.level1, d.level2, d.level3, d.level4, d.unclassified, 1);
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Question Depth</h3>
                <p className="text-xs text-gray-500 mb-4">Webb's Depth of Knowledge</p>
                <div className="space-y-3">
                  <DistributionBar label="1 · Recall" value={d.level1} max={max} color="bg-violet-400/70" />
                  <DistributionBar label="2 · Skill/Concept" value={d.level2} max={max} color="bg-violet-500" />
                  <DistributionBar label="3 · Strategic" value={d.level3} max={max} color="bg-indigo-500" />
                  <DistributionBar label="4 · Extended" value={d.level4} max={max} color="bg-blue-500" />
                  {d.unclassified > 0 && <DistributionBar label="Unclassified" value={d.unclassified} max={max} color="bg-gray-600" />}
                </div>
              </div>
            );
          })()}

          {s?.praise && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Praise &amp; Correction</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge label="Specific praise" value={s.praise.specific} />
                <StatBadge label="General praise" value={s.praise.general} />
                <StatBadge label="Corrections" value={s.praise.correction} />
                <StatBadge label="Praise:Correction" value={s.praise.praiseToCorrectionRatio?.toFixed(1) ?? "—"} />
              </div>
            </div>
          )}

          {s?.teacherMoves && (() => {
            const m = s.teacherMoves;
            const max = Math.max(m.instruct, m.explain, m.question, m.feedback, m.manage, 1);
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Teacher Moves</h3>
                <div className="space-y-3">
                  <DistributionBar label="Explain" value={m.explain} max={max} color="bg-violet-500" />
                  <DistributionBar label="Question" value={m.question} max={max} color="bg-indigo-500" />
                  <DistributionBar label="Instruct" value={m.instruct} max={max} color="bg-blue-500" />
                  <DistributionBar label="Feedback" value={m.feedback} max={max} color="bg-cyan-500" />
                  <DistributionBar label="Manage" value={m.manage} max={max} color="bg-gray-500" />
                </div>
              </div>
            );
          })()}

          {s?.vocabGradeLevel && (() => {
            const v = s.vocabGradeLevel;
            if (v.teacherFleschKincaid === null) return null;
            const delta = v.deltaVsTarget;
            const deltaColor = delta === null ? "text-gray-400" : Math.abs(delta) <= 1 ? "text-green-400" : delta > 1 ? "text-amber-400" : "text-rose-400";
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Vocabulary Grade Level</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatBadge label="Teacher FK grade" value={v.teacherFleschKincaid.toFixed(1)} />
                  <StatBadge label="Target grade" value={gradeLabel(v.targetGrade)} />
                  <div className="bg-[#111] rounded-lg p-3 text-center">
                    <p className={`text-lg font-bold tabular-nums ${deltaColor}`}>
                      {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{delta === null ? "Set target grade" : "vs target"}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Metrics — Full Detail</h3>
          {s && (
            <div className="space-y-3">
              <EquityOfVoiceCard summary={s} focus={true} />
              <DialogueFlowCard summary={s} focus={true} />
              <LessonLaunchCard summary={s} focus={true} />
              <QuestionQualityCard summary={s} focus={true} />
              <StudentReasoningCard summary={s} focus={true} />
              <AcademicLanguageCard summary={s} focus={true} />
            </div>
          )}

          {transcript && transcript.segments?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Transcript</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {transcript.segments.map((seg, i) => (
                  <SegmentBubble
                    key={i}
                    segment={seg}
                    isActive={activeSegment === i}
                    onPlay={() => onSegmentPlay(i)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
