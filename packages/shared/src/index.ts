// Constants
export {
  INSIGHT_TYPES,
  TEACHER_MOVES,
  DOK_LEVELS,
  LESSON_INTENTS,
  PRACTICE_AREAS,
  RECORDING_STATUSES,
  REPORT_STATUSES,
  GOAL_STATUSES,
  SEGMENT_TYPES,
  MAX_RECORDING_SECONDS,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  SUPPORTED_MEDIA_FORMATS,
} from "./constants";
export type {
  InsightType,
  TeacherMove,
  DokLevel,
  LessonIntent,
  PracticeArea,
  RecordingStatus,
  ReportStatus,
  GoalStatus,
  SegmentType,
} from "./constants";

// Types — user
export type { User } from "./types/user";

// Types — recording
export type { LessonRecording } from "./types/recording";

// Types — report
export type {
  TalkTimeSummary,
  QuestionSummary,
  DokDistribution,
  PraiseSummary,
  TeacherMovesSummary,
  VocabGradeLevel,
  LessonLaunchCheck,
  LessonLaunchScore,
  QuestionQualityBreakdown,
  StudentReasoningResult,
  Tier2WordUsage,
  AcademicLanguageSummary,
  NextMove,
  WaitTimeSummary,
  ParticipationDistribution,
  DiscoursePatterns,
  ReportSummary,
  HighlightedMoment,
  LessonReport,
  TranscriptSegment,
  Transcript,
} from "./types/report";

// Types — insight
export type { Insight } from "./types/insight";

// Types — goal
export type { Goal, GoalProgress } from "./types/goal";

// Types — api
export type {
  PaginatedResponse,
  PresignedUrlResponse,
  ErrorResponse,
} from "./types/api";

// Validators — recording
export {
  CreateRecordingSchema,
  UploadUrlSchema,
} from "./validators/recording";
export type { CreateRecordingInput, UploadUrlInput } from "./validators/recording";

// Validators — goal
export {
  CreateGoalSchema,
  UpdateGoalSchema,
} from "./validators/goal";
export type { CreateGoalInput, UpdateGoalInput } from "./validators/goal";

// Validators — user
export { UpdateUserSchema } from "./validators/user";
export type { UpdateUserInput } from "./validators/user";
