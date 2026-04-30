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

export type GoalProgressPayload =
  | {
      kind: "dok_mix";
      level1: number;
      level2: number;
      level3: number;
      level4: number;
      unclassified: number;
    }
  | {
      kind: "praise_ratio";
      specific: number;
      general: number;
      correction: number;
      specificToCorrection: number | null;
    }
  | {
      kind: "vocab_match";
      teacherFleschKincaid: number | null;
      targetGrade: number | null;
      deltaVsTarget: number | null;
    };

export interface GoalProgress {
  id: string;
  goalId: string;
  reportId: string;
  value: number;
  createdAt: string;
  payload: GoalProgressPayload | null;
}
