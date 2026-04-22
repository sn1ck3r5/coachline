import type { ReportStatus, SegmentType } from "../constants";

export interface TalkTimeSummary {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

export interface QuestionSummary {
  total: number;
  openEnded: number;
  closed: number;
  focusing: number;
  procedural: number;
  rhetorical: number;
}

export interface WaitTimeSummary {
  waitTime1Count: number;
  waitTime1AvgMs: number;
  waitTime2Count: number;
  waitTime2AvgMs: number;
  bestMoments: Array<{ startMs: number; durationMs: number }>;
}

export interface ReportSummary {
  talkTime: TalkTimeSummary;
  questions: QuestionSummary;
  waitTime: WaitTimeSummary;
  uptakeCount: number;
  longStudentTalkCount: number;
  studentQuestionCount: number;
  totalDurationMs: number;
}

export interface HighlightedMoment {
  title: string;
  description: string;
  startMs: number;
  endMs: number;
  type: string;
}

export interface LessonReport {
  id: string;
  recordingId: string;
  userId: string;
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
  status: ReportStatus;
  createdAt: string;
}

export interface TranscriptSegment {
  speaker: "teacher" | "student";
  text: string;
  startMs: number;
  endMs: number;
  type: SegmentType;
}

export interface Transcript {
  id: string;
  reportId: string;
  segments: TranscriptSegment[];
  fullText: string;
}
