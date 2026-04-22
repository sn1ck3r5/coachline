import type { InsightType } from "../constants";

export interface Insight {
  id: string;
  reportId: string;
  type: InsightType;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
