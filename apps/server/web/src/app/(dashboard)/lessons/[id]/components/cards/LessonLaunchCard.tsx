import type { ReportSummary } from "@coachline/shared";

export function LessonLaunchCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const ll = summary.lessonLaunch;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-yellow-500 relative">
        <div className="absolute top-2 right-3 bg-yellow-900/60 text-yellow-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🚀 Lesson Launch</p>
        {!ll ? (
          <p className="text-xs text-slate-500">No teacher speech detected in first 5 minutes.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-3">
              {(["learningIntention", "successCriteria", "relevanceHook"] as const).map((key) => {
                const labels: Record<string, string> = {
                  learningIntention: "Learning intention",
                  successCriteria: "Success criteria",
                  relevanceHook: "Relevance hook",
                };
                const check = ll[key];
                return (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className={check.detected ? "text-emerald-400" : "text-red-400"}>
                      {check.detected ? "✓" : "✗"}
                    </span>
                    <span className={check.detected ? "text-white" : "text-slate-500"}>{labels[key]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold text-sm">{ll.score} / 3</span>
              <span className="text-[9px] text-slate-500">Hattie d=0.84–0.88</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🚀 Lesson Launch</p>
      <p className="text-lg font-bold text-yellow-400">
        {ll?.score ?? "—"}<span className="text-[10px] text-slate-500">/3</span>
      </p>
      <p className="text-[9px] text-slate-500">clarity score</p>
    </div>
  );
}
