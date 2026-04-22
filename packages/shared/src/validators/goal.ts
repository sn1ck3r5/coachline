import { z } from "zod";
import { PRACTICE_AREAS, GOAL_STATUSES } from "../constants";

export const CreateGoalSchema = z
  .object({
    practiceArea: z.enum(PRACTICE_AREAS),
    targetMetric: z.string().min(1),
    customLabel: z.string().min(1).optional(),
  })
  .refine(
    (data) => data.practiceArea !== "custom" || data.customLabel !== undefined,
    { message: "customLabel is required for custom practice area", path: ["customLabel"] }
  );
export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = z.object({
  status: z.enum(GOAL_STATUSES).optional(),
  targetMetric: z.string().min(1).optional(),
});
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;
