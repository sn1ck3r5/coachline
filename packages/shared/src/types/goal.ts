import type { PracticeArea, GoalStatus } from "../constants";

export interface Goal {
  id: string;
  userId: string;
  practiceArea: PracticeArea;
  targetMetric: string;
  customLabel: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  id: string;
  goalId: string;
  reportId: string;
  value: number;
  createdAt: string;
}
