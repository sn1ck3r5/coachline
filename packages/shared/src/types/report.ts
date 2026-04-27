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

// How evenly distributed student participation is across all heard student voices.
// Computed from diarized speaker IDs — no demographic data required.
export interface ParticipationDistribution {
  // Number of distinct student speaker IDs that spoke at least once.
  uniqueStudentVoices: number;
  // Gini coefficient of talk-time across student speakers: 0 = perfectly equal,
  // 1 = one student monopolizes all talk. Null when < 2 student voices.
  giniCoefficient: number | null;
  // Fraction of total student talk time produced by the top 3 speakers.
  // Null when < 3 student voices.
  top3SpeakersPercent: number | null;
}

// Sequence-level analysis of who talks to whom — measures the degree of
// teacher-mediated vs. student-to-student discourse.
export interface DiscoursePatterns {
  // Fraction of student turns immediately preceded by a teacher turn (ping-pong).
  pingPongIndex: number;
  // Fraction of student turns immediately preceded by another student turn (volleyball).
  volleyballIndex: number;
  // Longest uninterrupted run of consecutive student turns without a teacher turn.
  maxStudentChainLength: number;
  // Of the content questions (open/closed/focusing) that received a student
  // response, the fraction NOT followed by an uptake move within 15 s.
  // Null when there are no such questions.
  ireClosureRate: number | null;
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
  participationDistribution: ParticipationDistribution;
  discoursePatterns: DiscoursePatterns;
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
