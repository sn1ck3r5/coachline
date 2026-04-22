import type { RecordingStatus } from "../constants";

export interface LessonRecording {
  id: string;
  userId: string;
  audioUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
  status: RecordingStatus;
  title: string | null;
  recordedAt: string;
  createdAt: string;
}
