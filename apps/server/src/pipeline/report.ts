import { invokeClaudeJson } from "../services/bedrock";
import type {
  ReportSummary,
  HighlightedMoment,
  TranscriptSegment,
  DokDistribution,
  PraiseSummary,
  TeacherMovesSummary,
  VocabGradeLevel,
} from "@coachline/shared";
import { computeTeacherFleschKincaid } from "./readability";

interface RawInsight {
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
}

interface TalkTime {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

interface GenerateReportInput {
  insights: RawInsight[];
  talkTime: TalkTime;
  totalDurationMs: number;
  activeGoal?: { practiceArea: string; targetMetric: string } | null;
  teacherSegments: TranscriptSegment[];
  targetGrade: number | null;
}

interface GenerateReportResult {
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
}

const SYSTEM_PROMPT = `You are an instructional coach synthesizing lesson analysis data into a coaching report. Your tone is encouraging and growth-oriented — lead with strengths, then areas for growth.

Given the raw analysis data, generate:

1. subject: one of "math", "ela", "science", "social_studies", "other" (best inference from the transcript content; "other" when unclear).
2. topic: short phrase naming the specific topic taught (e.g. "adding fractions with unlike denominators", "American Revolution causes", "photosynthesis"). Null when the transcript is too short or topic is unclear.
3. highlightedMoments: top 3-5 notable moments. Each has:
   - title: short label (e.g., "Great uptake at 14:32")
   - description: 1-2 sentences on what happened and why it matters
   - startMs, endMs: timestamps
   - type: the insight type this relates to
4. reflectionPrompts: 2-3 personalized reflection questions based on THIS lesson's data. Reference actual numbers or moments. Do not be generic.

If the teacher has an active goal, weight highlights and prompts toward that practice area.

Return JSON with exactly these keys: subject, topic, highlightedMoments, reflectionPrompts`;

function computeDokDistribution(questions: RawInsight[]): DokDistribution {
  const dist: DokDistribution = {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    unclassified: 0,
  };
  for (const q of questions) {
    const raw = (q.metadata as { dokLevel?: unknown }).dokLevel;
    const level = typeof raw === "number" ? raw : null;
    if (level === 1) dist.level1++;
    else if (level === 2) dist.level2++;
    else if (level === 3) dist.level3++;
    else if (level === 4) dist.level4++;
    else dist.unclassified++;
  }
  return dist;
}

function computePraiseSummary(insights: RawInsight[]): PraiseSummary {
  const specific = insights.filter((i) => i.type === "praise_specific").length;
  const general = insights.filter((i) => i.type === "praise_general").length;
  const correction = insights.filter((i) => i.type === "correction").length;
  const totalPraise = specific + general;
  return {
    specific,
    general,
    correction,
    specificVsGeneralRatio:
      totalPraise > 0 ? Math.round((specific / totalPraise) * 1000) / 1000 : null,
    praiseToCorrectionRatio:
      correction > 0 ? Math.round((totalPraise / correction) * 1000) / 1000 : null,
  };
}

function computeTeacherMovesSummary(
  insights: RawInsight[]
): TeacherMovesSummary {
  return {
    instruct: insights.filter((i) => i.type === "teacher_instruct").length,
    explain: insights.filter((i) => i.type === "teacher_explain").length,
    question: insights.filter((i) => i.type.startsWith("question_")).length,
    feedback: insights.filter((i) => i.type === "teacher_feedback").length,
    manage: insights.filter((i) => i.type === "teacher_manage").length,
  };
}

function computeVocabGradeLevel(
  teacherSegments: TranscriptSegment[],
  targetGrade: number | null
): VocabGradeLevel {
  const teacherFleschKincaid = computeTeacherFleschKincaid(teacherSegments);
  const deltaVsTarget =
    teacherFleschKincaid !== null && targetGrade !== null
      ? Math.round((teacherFleschKincaid - targetGrade) * 10) / 10
      : null;
  return { teacherFleschKincaid, targetGrade, deltaVsTarget };
}

export async function generateReport(
  input: GenerateReportInput
): Promise<GenerateReportResult> {
  const {
    insights,
    talkTime,
    totalDurationMs,
    activeGoal,
    teacherSegments,
    targetGrade,
  } = input;

  const questions = insights.filter((i) => i.type.startsWith("question_"));
  const waitTime1 = insights.filter((i) => i.type === "wait_time_1");
  const waitTime2 = insights.filter((i) => i.type === "wait_time_2");
  const uptake = insights.filter((i) => i.type === "uptake");
  const longStudentTalk = insights.filter(
    (i) => i.type === "long_student_talk"
  );

  const avgWt1 =
    waitTime1.length > 0
      ? waitTime1.reduce((sum, i) => sum + i.durationMs, 0) / waitTime1.length
      : 0;
  const avgWt2 =
    waitTime2.length > 0
      ? waitTime2.reduce((sum, i) => sum + i.durationMs, 0) / waitTime2.length
      : 0;

  // LLM-derived fields (subject, topic) come from the report call below,
  // so build the summary without them first, then fold them in.
  const baseSummary: Omit<ReportSummary, "subject" | "topic"> = {
    talkTime,
    questions: {
      total: questions.length,
      openEnded: questions.filter((q) => q.type === "question_open").length,
      closed: questions.filter((q) => q.type === "question_closed").length,
      focusing: questions.filter((q) => q.type === "question_focusing").length,
      procedural: questions.filter((q) => q.type === "question_procedural").length,
      rhetorical: questions.filter((q) => q.type === "question_rhetorical").length,
      dok: computeDokDistribution(questions),
    },
    waitTime: {
      waitTime1Count: waitTime1.length,
      waitTime1AvgMs: Math.round(avgWt1),
      waitTime2Count: waitTime2.length,
      waitTime2AvgMs: Math.round(avgWt2),
      bestMoments: waitTime1
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 3)
        .map((w) => ({ startMs: w.startMs, durationMs: w.durationMs })),
    },
    uptakeCount: uptake.length,
    longStudentTalkCount: longStudentTalk.length,
    studentQuestionCount: 0, // Deferred to Wave 2 (AI-05)
    totalDurationMs,
    praise: computePraiseSummary(insights),
    teacherMoves: computeTeacherMovesSummary(insights),
    vocabGradeLevel: computeVocabGradeLevel(teacherSegments, targetGrade),
  };

  // Generate subject/topic/highlights/prompts via Claude.
  const dataForClaude = JSON.stringify({
    summary: baseSummary,
    insightSamples: insights.slice(0, 30),
    activeGoal,
    targetGrade,
  });

  const { subject, topic, highlightedMoments, reflectionPrompts } =
    await invokeClaudeJson<{
      subject: string | null;
      topic: string | null;
      highlightedMoments: HighlightedMoment[];
      reflectionPrompts: string[];
    }>(SYSTEM_PROMPT, [
      {
        role: "user",
        content: `Generate the coaching report from this data:\n\n${dataForClaude}`,
      },
    ]);

  const summary: ReportSummary = {
    ...baseSummary,
    subject: subject ?? null,
    topic: topic ?? null,
  };

  return { summary, highlightedMoments, reflectionPrompts };
}
