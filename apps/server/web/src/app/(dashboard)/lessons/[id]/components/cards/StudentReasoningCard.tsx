import type { ReportSummary } from "@coachline/shared";

export function StudentReasoningCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const r = summary.studentReasoning;
  const pct = r.reasoningRatio !== null ? Math.round(r.reasoningRatio * 100) : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-emerald-500 relative">
        <div className="absolute top-2 right-3 bg-emerald-900/60 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🧠 Student Reasoning</p>
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="text-slate-400">Reasoning turns</span>
          <span className="text-emerald-400 font-bold">{pct ?? "—"}%</span>
        </div>
        <div className="h-1.5 bg-[#0f172a] rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full" style={{ width: `${pct ?? 0}%` }} />
        </div>
        <p className="text-[9px] text-slate-500 mb-2">Target: 50%+ for discussion/inquiry</p>
        {r.topTriggeringMoveType && (
          <p className="text-[10px] text-emerald-300 bg-emerald-900/30 rounded px-2 py-1.5 leading-snug">
            Most reasoning followed your <strong>{r.topTriggeringMoveType}</strong> moves. More of those → more because/since/therefore.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🧠 Student Reasoning</p>
      <p className="text-lg font-bold text-emerald-400">{pct ?? "—"}%</p>
      <p className="text-[9px] text-slate-500">reasoning turns</p>
    </div>
  );
}
