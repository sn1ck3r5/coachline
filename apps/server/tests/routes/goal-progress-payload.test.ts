import { describe, it, expect } from "vitest";
import { buildPayload } from "../../src/routes/goal-progress-payload";
import type { ReportSummary } from "@coachline/shared";

function baseSummary(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    talkTime: { teacherPercent: 0, studentPercent: 0, groupPercent: 0, silencePercent: 0, mediaPercent: 0 },
    questions: {
      total: 0, openEnded: 0, closed: 0, focusing: 0, procedural: 0, rhetorical: 0,
      dok: { level1: 1, level2: 2, level3: 3, level4: 4, unclassified: 0 },
    },
    waitTime: { waitTime1Count: 0, waitTime1AvgMs: 0, waitTime2Count: 0, waitTime2AvgMs: 0, bestMoments: [] },
    uptakeCount: 0,
    longStudentTalkCount: 0,
    studentQuestionCount: 0,
    totalDurationMs: 0,
    praise: { specific: 8, general: 1, correction: 2, specificVsGeneralRatio: null, praiseToCorrectionRatio: 4 },
    teacherMoves: { instruct: 0, explain: 0, question: 0, feedback: 0, manage: 0 },
    subject: null,
    topic: null,
    vocabGradeLevel: { teacherFleschKincaid: 7.2, targetGrade: 6, deltaVsTarget: 1.2 },
    lessonLaunch: null,
    questionQuality: { focusing: 0, funneling: 0, focusingRatio: null },
    studentReasoning: { reasoningTurnCount: 0, totalStudentTurnCount: 0, reasoningRatio: null, topTriggeringMoveType: null },
    academicLanguage: { tier2Words: [], tier2Count: 0, definitionRate: null },
    participationDistribution: { uniqueStudentVoices: 0, giniCoefficient: null, top3SpeakersPercent: null },
    discoursePatterns: { pingPongIndex: 0, volleyballIndex: 0, maxStudentChainLength: 0, ireClosureRate: null },
    nextMove: null,
    ...overrides,
  };
}

describe("buildPayload", () => {
  it("returns null for areas without a bespoke payload", () => {
    expect(buildPayload("wait_time", baseSummary())).toBeNull();
    expect(buildPayload("open_questions", baseSummary())).toBeNull();
    expect(buildPayload("custom", baseSummary())).toBeNull();
    expect(buildPayload("equity_of_voice", baseSummary())).toBeNull();
  });

  it("projects dok_mix from summary.questions.dok", () => {
    const result = buildPayload("dok_mix", baseSummary());
    expect(result).toEqual({
      kind: "dok_mix", level1: 1, level2: 2, level3: 3, level4: 4, unclassified: 0,
    });
  });

  it("returns null for dok_mix when summary.questions.dok is missing", () => {
    const summary = baseSummary();
    (summary.questions as unknown as Record<string, unknown>).dok = undefined;
    expect(buildPayload("dok_mix", summary)).toBeNull();
  });

  it("projects praise_ratio with computed specific/correction ratio", () => {
    const result = buildPayload("praise_ratio", baseSummary());
    expect(result).toEqual({
      kind: "praise_ratio", specific: 8, general: 1, correction: 2, specificToCorrection: 4,
    });
  });

  it("returns null specificToCorrection when correction is zero", () => {
    const summary = baseSummary({
      praise: { specific: 5, general: 0, correction: 0, specificVsGeneralRatio: null, praiseToCorrectionRatio: null },
    });
    const result = buildPayload("praise_ratio", summary);
    expect(result).toEqual({
      kind: "praise_ratio", specific: 5, general: 0, correction: 0, specificToCorrection: null,
    });
  });

  it("projects vocab_match including null fields", () => {
    const result = buildPayload("vocab_match", baseSummary());
    expect(result).toEqual({
      kind: "vocab_match", teacherFleschKincaid: 7.2, targetGrade: 6, deltaVsTarget: 1.2,
    });
  });

  it("returns null vocab_match when summary.vocabGradeLevel is missing", () => {
    const summary = baseSummary();
    (summary as unknown as Record<string, unknown>).vocabGradeLevel = undefined;
    expect(buildPayload("vocab_match", summary)).toBeNull();
  });

  it("does not throw on null/undefined summary", () => {
    expect(buildPayload("dok_mix", null as unknown as ReportSummary)).toBeNull();
    expect(buildPayload("praise_ratio", undefined as unknown as ReportSummary)).toBeNull();
  });
});
