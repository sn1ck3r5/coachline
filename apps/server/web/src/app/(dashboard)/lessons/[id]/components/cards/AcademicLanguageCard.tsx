import type { ReportSummary } from "@coachline/shared";

export function AcademicLanguageCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const a = summary.academicLanguage;
  const defPct = a.definitionRate !== null ? Math.round(a.definitionRate * 100) : null;
  const topWords = a.tier2Words.slice(0, 5);

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-fuchsia-500 relative">
        <div className="absolute top-2 right-3 bg-fuchsia-900/60 text-fuchsia-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">📚 Academic Language</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topWords.map((w) => (
            <span key={w.word} className={`px-2 py-0.5 rounded text-[9px] font-medium ${w.definedInContext ? "bg-fuchsia-900/60 text-fuchsia-200" : "bg-[#1e1b4b] text-indigo-300"}`}>
              {w.word} ×{w.count}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mb-1">
          {a.tier2Count} Tier 2 words · {defPct ?? "—"}% defined in context
        </p>
        {a.definitionRate !== null && a.definitionRate < 0.5 && (
          <p className="text-[10px] text-fuchsia-300 bg-fuchsia-900/30 rounded px-2 py-1.5 leading-snug">
            Define vocabulary in context as you use it — students need 12+ exposures to acquire a word. (Beck et al. 2002)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">📚 Academic Language</p>
      <p className="text-lg font-bold text-fuchsia-400">{a.tier2Count}</p>
      <p className="text-[9px] text-slate-500">Tier 2 words</p>
    </div>
  );
}
