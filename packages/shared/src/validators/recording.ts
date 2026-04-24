import { z } from "zod";
import { LESSON_INTENTS, MAX_RECORDING_SECONDS, SUPPORTED_MEDIA_FORMATS } from "../constants";

export const CreateRecordingSchema = z.object({
  audioUrl: z.string().min(1),
  durationSeconds: z.number().int().positive().max(MAX_RECORDING_SECONDS),
  fileSizeBytes: z.number().int().positive(),
  title: z.string().min(1).optional(),
  intent: z.enum(LESSON_INTENTS).nullable().optional(),
});
export type CreateRecordingInput = z.infer<typeof CreateRecordingSchema>;

export const UploadUrlSchema = z.object({
  contentType: z.enum(SUPPORTED_MEDIA_FORMATS),
  fileName: z.string().min(1),
});
export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;
