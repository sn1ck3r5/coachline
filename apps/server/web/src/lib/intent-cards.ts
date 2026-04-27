export type CardKey =
  | "equity_of_voice"
  | "dialogue_flow"
  | "student_reasoning"
  | "lesson_launch"
  | "question_quality"
  | "academic_language";

export const ALL_CARDS: CardKey[] = [
  "equity_of_voice",
  "dialogue_flow",
  "student_reasoning",
  "lesson_launch",
  "question_quality",
  "academic_language",
];

// Returns the 3 focus cards for a given lesson intent.
// When intent is null (teacher didn't select one), returns empty — all cards shown at equal weight.
const INTENT_FOCUS: Record<string, CardKey[]> = {
  discussion:         ["equity_of_voice", "dialogue_flow", "student_reasoning"],
  inquiry:            ["question_quality", "student_reasoning", "dialogue_flow"],
  direct_instruction: ["lesson_launch", "academic_language", "question_quality"],
  workshop:           ["student_reasoning", "equity_of_voice", "academic_language"],
  collaborative:      ["equity_of_voice", "dialogue_flow", "student_reasoning"],
  review:             ["question_quality", "student_reasoning", "lesson_launch"],
  assessment:         ["question_quality", "equity_of_voice", "lesson_launch"],
};

export function getFocusCards(intent: string | null): CardKey[] {
  if (!intent) return [];
  return INTENT_FOCUS[intent] ?? [];
}

export function isFocusCard(card: CardKey, intent: string | null): boolean {
  return getFocusCards(intent).includes(card);
}
