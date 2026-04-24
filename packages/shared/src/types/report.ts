import type { ReportStatus, SegmentType } from "../constants";

export interface TalkTimeSummary {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

export interface DokDistribution {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  unclassified: number;
}

export interface QuestionSummary {
  total: number;
  openEnded: number;
  closed: number;
  focusing: number;
  procedural: number;
  rhetorical: number;
  dok: DokDistribution;
}

export interface PraiseSummary {
  specific: number;
  general: number;
  correction: number;
  // specific / (specific + general); null when no praise at all
  specificVsGeneralRatio: number | null;
  // (specific + general) / correction; null when no correction
  praiseToCorrectionRatio: number | null;
}

export interface TeacherMovesSummary {
  instruct: number;
  explain: number;
  question: number;
  feedback: number;
  manage: number;
}

export interface VocabGradeLevel {
  teacherFleschKincaid: number | null;
  targetGrade: number | null;
  deltaVsTarget: number | null;
}

export interface NextMove {
  // Short imperative title. e.g. "Add wait time 2 after each student response"
  title: string;
  // 1-2 sentences describing what to do in the next lesson.
  description: string;
  // One-sentence research basis. e.g. "Rowe (1986): wait time 2 doubles
  // student reasoning depth when used consistently."
  whyItWorks: string;
  // Optional sample teacher line/script the teacher can rehearse.
  rehearsalScript?: string;
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
  praise: PraiseSummary;
  teacherMoves: TeacherMovesSummary;
  subject: string | null;
  topic: string | null;
  vocabGradeLevel: VocabGradeLevel;
  // The single highest-leverage move to try in the next lesson, chosen by
  // the coach LLM in light of this lesson's data and the teacher's selected
  // intent. Null when there's not enough signal to recommend one.
  nextMove: NextMove | null;
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
