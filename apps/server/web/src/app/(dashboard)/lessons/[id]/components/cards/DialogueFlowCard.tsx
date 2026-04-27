import type { ReportSummary } from "@coachline/shared";

export function DialogueFlowCard({ summary, focus }: { summary: ReportSummary; focus: boolean }) {
  const d = summary.discoursePatterns;
  const pingPct = Math.round(d.pingPongIndex * 100);
  const ireClosePct = d.ireClosureRate !== null ? Math.round(d.ireClosureRate * 100) : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-sky-500 relative">
        <div className="absolute top-2 right-3 bg-sky-900/60 text-sky-300 text-[9px] font-bold px-2 py-0.5 rounded-full">★ FOCUS</div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🏓 Dialogue Flow</p>
        <div className="flex gap-1 flex-wrap mb-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={`t${i}`} className="w-3.5 h-2 rounded-sm bg-blue-700" />)}
          {Array.from({ length: 8 }).map((_, i) => <div key={`s${i}`} className="w-3.5 h-2 rounded-sm bg-emerald-800" />)}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-amber-400 font-bold text-sm">{pingPct}%</p>
            <p className="text-[8px] text-slate-500">🏓 ping-pong</p>
          </div>
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-emerald-400 font-bold text-sm">{100 - pingPct}%</p>
            <p className="text-[8px] text-slate-500">🏐 volleyball</p>
          </div>
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-pink-400 font-bold text-sm">{ireClosePct ?? "—"}%</p>
            <p className="text-[8px] text-slate-500">IRE close</p>
          </div>
        </div>
        <p className="text-[10px] text-sky-300 bg-sky-900/30 rounded px-2 py-1.5 leading-snug">
          For discussion, aim for 20%+ volleyball. Longest student chain: {d.maxStudentChainLength}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🏓 Dialogue Flow</p>
      <p className="text-lg font-bold text-amber-400">{pingPct}%</p>
      <p className="text-[9px] text-slate-500">ping-pong</p>
    </div>
  );
}
