export const INSIGHT_TYPES = [
  "question_open", "question_closed", "question_focusing",
  "question_procedural", "question_rhetorical",
  "wait_time_1", "wait_time_2", "uptake",
  "long_student_talk", "short_student_response",
  "praise_specific", "praise_general", "correction",
  "teacher_instruct", "teacher_explain", "teacher_feedback", "teacher_manage",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const TEACHER_MOVES = ["instruct", "explain", "question", "feedback", "manage"] as const;
export type TeacherMove = (typeof TEACHER_MOVES)[number];

export const DOK_LEVELS = [1, 2, 3, 4] as const;
export type DokLevel = (typeof DOK_LEVELS)[number];

export const LESSON_INTENTS = [
  "direct_instruction",
  "discussion",
  "inquiry",
  "workshop",
  "review",
  "collaborative",
  "assessment",
] as const;
export type LessonIntent = (typeof LESSON_INTENTS)[number];

export const PRACTICE_AREAS = [
  "wait_time", "open_questions", "student_talk_ratio", "uptake",
  "dok_mix", "praise_ratio", "vocab_match", "custom",
] as const;
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

export const RECORDING_STATUSES = ["uploading", "processing", "completed", "failed"] as const;
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export const REPORT_STATUSES = ["processing", "completed", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const GOAL_STATUSES = ["active", "completed", "paused"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const SEGMENT_TYPES = ["teacher_talk", "student_talk", "group_talk", "silence", "media"] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

export const MAX_RECORDING_SECONDS = 5400; // 90 minutes

export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/aac", "audio/ogg", "audio/webm",
] as const;

export const SUPPORTED_VIDEO_FORMATS = [
  "video/mp4", "video/webm", "video/quicktime",
] as const;

export const SUPPORTED_MEDIA_FORMATS = [
  ...SUPPORTED_AUDIO_FORMATS, ...SUPPORTED_VIDEO_FORMATS,
] as const;
