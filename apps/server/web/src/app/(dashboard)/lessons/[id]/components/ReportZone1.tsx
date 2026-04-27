import type { LessonReport } from "@coachline/shared";

const INTENT_LABELS: Record<string, string> = {
  direct_instruction: "Direct Instruction",
  discussion: "Discussion",
  inquiry: "Inquiry",
  workshop: "Workshop",
  review: "Review",
  collaborative: "Collaborative",
  assessment: "Assessment",
};

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  science: "Science",
  social_studies: "Social Studies",
  other: "Other",
};

export function ReportZone1({ report, intent }: { report: LessonReport; intent: string | null }) {
  const { summary, highlightedMoments, reflectionPrompts } = report;
  const totalMinutes = Math.floor((summary?.totalDurationMs ?? 0) / 60000);

  return (
    <div className="space-y-5">
      {/* Metadata bar */}
      <div className="flex flex-wrap gap-2">
        {intent && (
          <span className="px-3 py-1 rounded-full bg-blue-950 text-blue-300 text-xs font-semibold border border-blue-800">
            📋 {INTENT_LABELS[intent] ?? intent}
          </span>
        )}
        {summary?.subject && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {SUBJECT_LABELS[summary.subject] ?? summary.subject}
          </span>
        )}
        {summary?.topic && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {summary.topic}
          </span>
        )}
        {totalMinutes > 0 && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {totalMinutes} min
          </span>
        )}
      </div>

      {/* One Move hero */}
      {summary?.nextMove && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0c2a4a] to-[#1e293b] border border-blue-800 rounded-2xl p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mb-2">
            ⚡ One Move for Your Next Lesson
          </p>
          <p className="text-xl font-bold text-white leading-snug mb-3">{summary.nextMove.title}</p>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">{summary.nextMove.description}</p>
          <p className="text-xs text-slate-500 italic mb-4">{summary.nextMove.whyItWorks}</p>
          {summary.nextMove.rehearsalScript && (
            <div className="border-l-2 border-blue-500 pl-4 bg-white/[0.03] rounded-r-lg py-2 pr-3">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Try saying</p>
              <p className="text-sm text-slate-200 italic">&ldquo;{summary.nextMove.rehearsalScript}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Highlighted Moments */}
      {highlightedMoments?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">✨ Highlighted Moments</p>
          <div className="space-y-2">
            {highlightedMoments.map((m, i) => (
              <div key={i} className="flex gap-3 bg-[#1e293b] rounded-xl p-3 items-start">
                <span className="flex-shrink-0 bg-emerald-900 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
                  {Math.floor(m.startMs / 1000)}s →
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection Prompts */}
      {reflectionPrompts?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">🪞 Reflection Prompts</p>
          <div className="space-y-2">
            {reflectionPrompts.map((prompt, i) => (
              <div key={i} className="bg-[#1e293b] rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
                <span className="text-violet-400 font-bold mr-2">{i + 1}.</span>
                {prompt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
