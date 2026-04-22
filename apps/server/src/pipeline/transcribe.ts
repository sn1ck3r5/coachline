import { transcribeAudio } from "../services/deepgram";
import { computeSpeakerStats, identifyTeacherSpeaker } from "../services/speaker-match";
import type { TranscriptSegment } from "@coachline/shared";

interface TranscribeResult {
  segments: TranscriptSegment[];
  rawSegments: Array<{ speaker: number; startMs: number; endMs: number; text: string }>;
  teacherSpeakerId: number;
  fullText: string;
  durationMs: number;
}

export async function transcribeLesson(audioUrl: string): Promise<TranscribeResult> {
  const { segments: rawSegments, fullText, durationMs } = await transcribeAudio(audioUrl);

  // Identify which speaker is the teacher
  const speakerStats = computeSpeakerStats(rawSegments);
  const teacherSpeakerId = identifyTeacherSpeaker(speakerStats);

  // Map to labeled segments
  const segments: TranscriptSegment[] = rawSegments.map((seg) => ({
    speaker: seg.speaker === teacherSpeakerId ? "teacher" : "student",
    text: seg.text,
    startMs: seg.startMs,
    endMs: seg.endMs,
    type: seg.speaker === teacherSpeakerId ? "teacher_talk" : "student_talk",
  }));

  return { segments, rawSegments, teacherSpeakerId, fullText, durationMs };
}
