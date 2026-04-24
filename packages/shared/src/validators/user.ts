import { z } from "zod";

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  // Target grade: 0 = Kindergarten, 1-12 = grade number; null = unset
  targetGrade: z.number().int().min(0).max(12).nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
