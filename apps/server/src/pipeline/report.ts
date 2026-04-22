import { invokeClaudeJson } from "../services/bedrock";
import type { ReportSummary, HighlightedMoment } from "@coachline/shared";

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
}

interface GenerateReportResult {
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
}

const SYSTEM_PROMPT = `You are an instructional coach synthesizing lesson analysis data into a coaching report. Your tone is encouraging and growth-oriented — lead with strengths, then areas for growth.

Given the raw analysis data, generate:

1. highlightedMoments: The top 3-5 most notable moments from the lesson. Each has:
   - title: short label (e.g., "Great uptake at 14:32")
   - description: 1-2 sentences describing what happened and why it matters
   - startMs, endMs: timestamps
   - type: the insight type this relates to

2. reflectionPrompts: 2-3 personalized reflection questions based on the data. These should be specific to what happened in THIS lesson, not generic. Reference actual numbers.

If the teacher has an active goal, weight highlights and prompts toward that practice area.

Return JSON with keys: highlightedMoments, reflectionPrompts`;

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
  const { insights, talkTime, totalDurationMs, activeGoal } = input;

  // Compute summary stats from raw insights
  const questions = insights.filter((i) => i.type.startsWith("question_"));
  const waitTime1 = insights.filter((i) => i.type === "wait_time_1");
  const waitTime2 = insights.filter((i) => i.type === "wait_time_2");
  const uptake = insights.filter((i) => i.type === "uptake");
  const longStudentTalk = insights.filter((i) => i.type === "long_student_talk");

  const avgWt1 = waitTime1.length > 0
    ? waitTime1.reduce((sum, i) => sum + i.durationMs, 0) / waitTime1.length
    : 0;
  const avgWt2 = waitTime2.length > 0
    ? waitTime2.reduce((sum, i) => sum + i.durationMs, 0) / waitTime2.length
    : 0;

  const summary: ReportSummary = {
    talkTime,
    questions: {
      total: questions.length,
      openEnded: questions.filter((q) => q.type === "question_open").length,
      closed: questions.filter((q) => q.type === "question_closed").length,
      focusing: questions.filter((q) => q.type === "question_focusing").length,
      procedural: questions.filter((q) => q.type === "question_procedural").length,
      rhetorical: questions.filter((q) => q.type === "question_rhetorical").length,
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
  };

  // Generate highlights and reflection prompts via Claude
  const dataForClaude = JSON.stringify({
    summary,
    insightSamples: insights.slice(0, 30), // Limit context size
    activeGoal,
  });

  const { highlightedMoments, reflectionPrompts } = await invokeClaudeJson<{
    highlightedMoments: HighlightedMoment[];
    reflectionPrompts: string[];
  }>(SYSTEM_PROMPT, [
    { role: "user", content: `Generate the coaching report from this data:\n\n${dataForClaude}` },
  ]);

  return { summary, highlightedMoments, reflectionPrompts };
}
