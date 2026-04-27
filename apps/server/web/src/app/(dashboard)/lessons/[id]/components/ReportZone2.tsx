import type { ReportSummary } from "@coachline/shared";
import { ALL_CARDS, isFocusCard, type CardKey } from "@/lib/intent-cards";
import { EquityOfVoiceCard } from "./cards/EquityOfVoiceCard";
import { DialogueFlowCard } from "./cards/DialogueFlowCard";
import { StudentReasoningCard } from "./cards/StudentReasoningCard";
import { LessonLaunchCard } from "./cards/LessonLaunchCard";
import { QuestionQualityCard } from "./cards/QuestionQualityCard";
import { AcademicLanguageCard } from "./cards/AcademicLanguageCard";

const INTENT_LABELS: Record<string, string> = {
  direct_instruction: "Direct Instruction",
  discussion: "Discussion",
  inquiry: "Inquiry",
  workshop: "Workshop",
  review: "Review",
  collaborative: "Collaborative",
  assessment: "Assessment",
};

function CardComponent({ card, summary, focus }: { card: CardKey; summary: ReportSummary; focus: boolean }) {
  switch (card) {
    case "equity_of_voice": return <EquityOfVoiceCard summary={summary} focus={focus} />;
    case "dialogue_flow": return <DialogueFlowCard summary={summary} focus={focus} />;
    case "student_reasoning": return <StudentReasoningCard summary={summary} focus={focus} />;
    case "lesson_launch": return <LessonLaunchCard summary={summary} focus={focus} />;
    case "question_quality": return <QuestionQualityCard summary={summary} focus={focus} />;
    case "academic_language": return <AcademicLanguageCard summary={summary} focus={focus} />;
  }
}

export function ReportZone2({ summary, intent }: { summary: ReportSummary; intent: string | null }) {
  const focusCards = ALL_CARDS.filter((c) => isFocusCard(c, intent));
  const secondaryCards = ALL_CARDS.filter((c) => !isFocusCard(c, intent));
  const hasFocus = focusCards.length > 0;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">The Room</p>
        <div className="flex-1 h-px bg-[#1e293b]" />
        {intent && hasFocus && (
          <span className="px-3 py-1 rounded-full bg-blue-950 text-blue-300 text-[10px] font-semibold border border-blue-800">
            📋 {INTENT_LABELS[intent] ?? intent} lens
          </span>
        )}
      </div>

      {/* Focus cards — full size, 3-column */}
      {hasFocus && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {focusCards.map((card) => (
            <CardComponent key={card} card={card} summary={summary} focus={true} />
          ))}
        </div>
      )}

      {/* Secondary cards — condensed, 3-column */}
      <div className="grid grid-cols-3 gap-2">
        {(hasFocus ? secondaryCards : ALL_CARDS).map((card) => (
          <CardComponent key={card} card={card} summary={summary} focus={false} />
        ))}
      </div>
    </div>
  );
}
