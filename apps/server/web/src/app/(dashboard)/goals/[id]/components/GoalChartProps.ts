import type { GoalProgress } from "@coachline/shared";
import type { ResearchTarget } from "../lib/research-targets";

export interface GoalChartProps {
  points: Array<{ date: string; value: number }>;
  progress: GoalProgress[];
  target: ResearchTarget | null;
}
