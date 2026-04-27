import { invokeClaudeJson } from "../services/bedrock";
import type {
  ReportSummary,
  HighlightedMoment,
  TranscriptSegment,
  DokDistribution,
  PraiseSummary,
  TeacherMovesSummary,
  VocabGradeLevel,
  ParticipationDistribution,
  DiscoursePatterns,
  NextMove,
  LessonIntent,
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
  intent: LessonIntent | null;
  participationDistribution: ParticipationDistribution;
  discoursePatterns: DiscoursePatterns;
}

interface GenerateReportResult {
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
}

const SYSTEM_PROMPT = `You are an instructional coach synthesizing lesson analysis data into a coaching report. Your tone is encouraging and growth-oriented — lead with strengths, then areas for growth.

IMPORTANT — lesson intent: the teacher selects the lesson's intended pedagogical mode when they record. The intent is supplied in the user message (or null if the teacher didn't select one). You MUST interpret the metrics in light of the selected intent, not against a universal ideal. Specifically:

- direct_instruction (introducing a new concept or skill): high teacher-talk %, explain-heavy teacher moves, and short wait-time 1 are often APPROPRIATE at the start of the lesson. Flag problems only if checks-for-understanding were missing before moving on.
- discussion: low student-to-student talk, low uptake, or high teacher-talk % are misaligned with discussion intent. Flag them.
- inquiry: few student-generated questions, few open-ended questions, or low DOK 3-4 are misaligned with inquiry intent.
- workshop: look for mini-lesson → guided practice → conferring arc. Short student talk with teacher feedback is normal.
- review: high teacher-talk and closed questions are expected; look instead for misconception-surfacing.
- collaborative: low group talk % indicates misalignment with collaborative intent.
- assessment: more closed/procedural questions and lower uptake are expected; look for formative sampling.
- null (teacher did not select): evaluate against general effective-instruction principles without penalizing any single pattern.

Given the raw analysis data, generate:

1. subject: one of "math", "ela", "science", "social_studies", "other" (best inference from the transcript content; "other" when unclear).
2. topic: short phrase naming the specific topic taught (e.g. "adding fractions with unlike denominators"). Null when unclear.
3. highlightedMoments: top 3-5 notable moments. Each has:
   - title: short label (e.g., "Great uptake at 14:32")
   - description: 1-2 sentences on what happened and why it matters, referencing the intent where relevant
   - startMs, endMs: timestamps
   - type: the insight type this relates to
4. reflectionPrompts: 2-3 personalized reflection questions based on THIS lesson's data, with explicit intent framing ("Your intent was <X>; given that…"). Reference actual numbers.
5. nextMove: THE ONE highest-leverage move to try in the very next lesson. This is the core of the coaching loop — one move, not a list. Object with:
   - title: short imperative. e.g. "Add wait time 2 after student responses" (under 60 chars)
   - description: 1-2 sentences describing exactly what to do in the next lesson. Specific. Actionable.
   - whyItWorks: 1 sentence, research-grounded. Cite the underlying research concept briefly (e.g. "Rowe (1986): wait time 2 doubles student reasoning depth"). Do not invent citations — use the concepts named in the INSIGHT_TYPES we collected (DOK, PBIS praise, TalkMoves uptake, Flesch-Kincaid, etc.).
   - rehearsalScript: optional. A ~25-word sample teacher line the teacher can rehearse saying. Omit the field if no script is useful.
   Pick the move that best serves the gap between the teacher's selected intent and what the lesson actually showed. If data is thin, return nextMove: null.

==== PARTICIPATION & DISCOURSE ====

Three new metrics are included in the data. Interpret them as follows:

participationDistribution:
- uniqueStudentVoices: how many distinct student voices were heard. Fewer voices doesn't always mean low engagement — small classes or structured silent work are fine.
- giniCoefficient: 0 = perfectly equal student talk; 1 = one student monopolizes. Scores above 0.6 in discussion/collaborative lessons warrant a coaching note.
- top3SpeakersPercent: if ≥ 0.7 in an open discussion, a small group is dominating. Flag for discussion/collaborative intents; acceptable for direct_instruction.

discoursePatterns:
- pingPongIndex: fraction of student turns preceded by a teacher turn. High (>0.85) in discussion/collaborative/inquiry intents signals teacher is the hub of all talk — students are not talking to each other.
- volleyballIndex: fraction of student turns preceded by another student turn. Higher is better for discussion/collaborative intents.
- maxStudentChainLength: longest uninterrupted student-to-student exchange. 0 = pure ping-pong; ≥ 3 = some genuine student dialogue.
- ireClosureRate: fraction of content questions where the teacher closed with evaluation rather than uptake. High rates (>0.7) indicate dialogic potential is being shut down — the teacher is generating discourse events but immediately closing them. This is distinct from uptakeCount — a teacher can have low uptake AND high IRE closure (actively suppressing dialogue), or low uptake but also low closure (questions going unanswered).

For the nextMove, these metrics are high-signal when they reveal a structural pattern (not just a single moment). Prefer citing them when they're clearly tied to intent mismatch.

If the teacher has an active goal, weight highlights and the nextMove toward that practice area.

Return JSON with exactly these keys: subject, topic, highlightedMoments, reflectionPrompts, nextMove`;

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
    intent,
    participationDistribution,
    discoursePatterns,
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

  // LLM-derived fields (subject, topic, nextMove) come from the report call
  // below, so build the summary without them first and fold them in after.
  const baseSummary: Omit<ReportSummary, "subject" | "topic" | "nextMove"> = {
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
    // Placeholders — populated by Tasks 5–6 once all pipeline signals are wired.
    lessonLaunch: null,
    questionQuality: { focusing: 0, funneling: 0, focusingRatio: null },
    studentReasoning: { reasoningTurnCount: 0, totalStudentTurnCount: 0, reasoningRatio: null, topTriggeringMoveType: null },
    academicLanguage: { tier2Words: [], tier2Count: 0, definitionRate: null },
    participationDistribution,
    discoursePatterns,
  };

  // Generate subject/topic/highlights/prompts/nextMove via Claude.
  const dataForClaude = JSON.stringify({
    summary: baseSummary,
    insightSamples: insights.slice(0, 30),
    activeGoal,
    targetGrade,
    intent,
  });

  const { subject, topic, highlightedMoments, reflectionPrompts, nextMove } =
    await invokeClaudeJson<{
      subject: string | null;
      topic: string | null;
      highlightedMoments: HighlightedMoment[];
      reflectionPrompts: string[];
      nextMove: NextMove | null;
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
    nextMove: nextMove ?? null,
  };

  return { summary, highlightedMoments, reflectionPrompts };
}
