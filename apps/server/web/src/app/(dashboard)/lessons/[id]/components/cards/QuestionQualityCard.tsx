import type { ReportSummary } from "@coachline/shared";

export function QuestionQualityCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const q = summary.questionQuality;
  const focusingPct = q.focusingRatio !== null ? Math.round(q.focusingRatio * 100) : null;
  const funnelingPct = focusingPct !== null ? 100 - focusingPct : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-orange-500 relative">
        <div className="absolute top-2 right-3 bg-orange-900/60 text-orange-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">❓ Question Quality</p>
        {q.focusingRatio === null ? (
          <p className="text-xs text-slate-500">No open questions detected.</p>
        ) : (
          <>
            <div className="h-2 rounded-full overflow-hidden flex mb-2">
              <div className="bg-orange-500" style={{ width: `${focusingPct}%` }} />
              <div className="bg-red-700" style={{ width: `${funnelingPct}%` }} />
            </div>
            <div className="flex gap-4 text-[10px] mb-3">
              <span className="text-orange-400">{focusingPct}% focusing</span>
              <span className="text-red-400">{funnelingPct}% funneling</span>
            </div>
            <p className="text-[10px] text-orange-300 bg-orange-900/30 rounded px-2 py-1.5 leading-snug">
              Benchmark: 60%+ focusing. RCT evidence: AI feedback → 20% more focusing in 4 weeks.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">❓ Question Quality</p>
      <p className="text-lg font-bold text-orange-400">{focusingPct ?? "—"}%</p>
      <p className="text-[9px] text-slate-500">focusing</p>
    </div>
  );
}
