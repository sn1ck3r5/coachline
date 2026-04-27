import type { ReportSummary } from "@coachline/shared";

export function EquityOfVoiceCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const p = summary.participationDistribution;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-purple-500 relative">
        <div className="absolute top-2 right-3 bg-purple-900/60 text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🗣 Equity of Voice</p>
        <div className="flex items-end gap-1.5 mb-3 h-9">
          {Array.from({ length: Math.min(p.uniqueStudentVoices, 7) }).map((_, i) => {
            const size = Math.max(8, 28 - i * 3);
            return (
              <div key={i} className="rounded-full bg-purple-700 flex-shrink-0" style={{ width: size, height: size }} />
            );
          })}
          {p.uniqueStudentVoices === 0 && <span className="text-xs text-slate-500">No student voices detected</span>}
        </div>
        <p className="text-sm font-semibold text-white">
          {p.uniqueStudentVoices} student{p.uniqueStudentVoices !== 1 ? "s" : ""} heard
        </p>
        {p.giniCoefficient !== null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Gini {p.giniCoefficient.toFixed(2)} · {p.giniCoefficient > 0.6 ? "concentrated" : "distributed"}
          </p>
        )}
        {p.top3SpeakersPercent !== null && (
          <p className="mt-3 text-[10px] text-purple-300 bg-purple-900/40 rounded px-2 py-1.5 leading-snug">
            Top 3 speakers held {Math.round(p.top3SpeakersPercent * 100)}% of student talk. For discussion, aim for &lt;40%.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🗣 Equity of Voice</p>
      <p className="text-lg font-bold text-white">{p.uniqueStudentVoices}</p>
      <p className="text-[9px] text-slate-500">voices heard</p>
    </div>
  );
}
