import type { PracticeArea } from "@coachline/shared";

export interface ResearchTarget {
  value: number;
  label: string;
  comparator: ">=" | "<=" | "between";
  band?: [number, number];
  source: string;
}

export const RESEARCH_TARGETS: Record<PracticeArea, ResearchTarget | null> = {
  wait_time:          { value: 3,    label: "≥3 seconds",                comparator: ">=",      source: "Rowe (1986)" },
  open_questions:     { value: 40,   label: "≥40% open",                  comparator: ">=",      source: "Walsh & Sattes" },
  student_talk_ratio: { value: 50,   label: "≥50% student talk",          comparator: ">=",      source: "50/50 rule" },
  uptake:             { value: 40,   label: "≥40% of student turns",      comparator: ">=",      source: "Nystrand" },
  dok_mix:            { value: 40,   label: "≥40% at DOK 3 or 4",         comparator: ">=",      source: "Webb" },
  praise_ratio:       { value: 4,    label: "4:1 specific to correction", comparator: ">=",      source: "PBIS / Sprick" },
  vocab_match:        { value: 0,    label: "within ±1 grade level",      comparator: "between", band: [-1, 1], source: "Hiebert" },
  equity_of_voice:    { value: 0.4,  label: "Gini ≤ 0.4",                 comparator: "<=",      source: "Lorenz/Gini convention" },
  dialogue_quality:   { value: 25,   label: "≥25% volleyball turns",      comparator: ">=",      source: "Mercer & Howe" },
  lesson_clarity:     { value: 3,    label: "3 of 3 elements detected",   comparator: ">=",      source: "Hattie" },
  custom:             null,
};

export function getResearchTarget(area: PracticeArea): ResearchTarget | null {
  return RESEARCH_TARGETS[area];
}
