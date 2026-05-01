import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

const goalFindFirst = vi.fn();
const goalProgressFindMany = vi.fn();

vi.mock("@prisma/client", () => {
  class PrismaClient {
    goal = { findFirst: goalFindFirst };
    goalProgress = { findMany: goalProgressFindMany };
  }
  return { PrismaClient };
});

import { buildApp } from "../setup";
import { createAccessToken } from "../../src/plugins/auth";

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

const REPORT_SUMMARY_BASE = {
  talkTime: { teacherPercent: 0, studentPercent: 0, groupPercent: 0, silencePercent: 0, mediaPercent: 0 },
  questions: {
    total: 0, openEnded: 0, closed: 0, focusing: 0, procedural: 0, rhetorical: 0,
    dok: { level1: 4, level2: 3, level3: 2, level4: 1, unclassified: 0 },
  },
  waitTime: { waitTime1Count: 0, waitTime1AvgMs: 0, waitTime2Count: 0, waitTime2AvgMs: 0, bestMoments: [] },
  uptakeCount: 0,
  longStudentTalkCount: 0,
  studentQuestionCount: 0,
  totalDurationMs: 0,
  praise: { specific: 12, general: 1, correction: 3, specificVsGeneralRatio: null, praiseToCorrectionRatio: 4 },
  teacherMoves: { instruct: 0, explain: 0, question: 0, feedback: 0, manage: 0 },
  subject: null,
  topic: null,
  vocabGradeLevel: { teacherFleschKincaid: 8.4, targetGrade: 7, deltaVsTarget: 1.4 },
  lessonLaunch: null,
  questionQuality: { focusing: 0, funneling: 0, focusingRatio: null },
  studentReasoning: { reasoningTurnCount: 0, totalStudentTurnCount: 0, reasoningRatio: null, topTriggeringMoveType: null },
  academicLanguage: { tier2Words: [], tier2Count: 0, definitionRate: null },
  participationDistribution: { uniqueStudentVoices: 0, giniCoefficient: null, top3SpeakersPercent: null },
  discoursePatterns: { pingPongIndex: 0, volleyballIndex: 0, maxStudentChainLength: 0, ireClosureRate: null },
  nextMove: null,
};

describe("GET /goals/:id/progress", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    token = await createAccessToken(TEST_USER_ID, "teacher@school.edu");
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns dok_mix payload for a dok_mix goal", async () => {
    goalFindFirst.mockResolvedValueOnce({
      id: "goal-dok",
      userId: TEST_USER_ID,
      practiceArea: "dok_mix",
    });
    goalProgressFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        goalId: "goal-dok",
        reportId: "r1",
        value: 30,
        createdAt: new Date("2026-04-29T10:00:00Z"),
        report: { summary: REPORT_SUMMARY_BASE },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-dok/progress",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].payload).toEqual({
      kind: "dok_mix",
      level1: 4, level2: 3, level3: 2, level4: 1, unclassified: 0,
    });
    expect(body[0].value).toBe(30);
  });

  it("returns praise_ratio payload with computed specific:correction ratio", async () => {
    goalFindFirst.mockResolvedValueOnce({
      id: "goal-praise",
      userId: TEST_USER_ID,
      practiceArea: "praise_ratio",
    });
    goalProgressFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        goalId: "goal-praise",
        reportId: "r1",
        value: 4,
        createdAt: new Date("2026-04-29T10:00:00Z"),
        report: { summary: REPORT_SUMMARY_BASE },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-praise/progress",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<Record<string, unknown>>;
    expect(body[0].payload).toEqual({
      kind: "praise_ratio",
      specific: 12, general: 1, correction: 3, specificToCorrection: 4,
    });
  });

  it("returns vocab_match payload with signed delta", async () => {
    goalFindFirst.mockResolvedValueOnce({
      id: "goal-vocab",
      userId: TEST_USER_ID,
      practiceArea: "vocab_match",
    });
    goalProgressFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        goalId: "goal-vocab",
        reportId: "r1",
        value: 1.4,
        createdAt: new Date("2026-04-29T10:00:00Z"),
        report: { summary: REPORT_SUMMARY_BASE },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-vocab/progress",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<Record<string, unknown>>;
    expect(body[0].payload).toEqual({
      kind: "vocab_match",
      teacherFleschKincaid: 8.4, targetGrade: 7, deltaVsTarget: 1.4,
    });
  });

  it("returns null payload for areas without bespoke projection", async () => {
    goalFindFirst.mockResolvedValueOnce({
      id: "goal-wait",
      userId: TEST_USER_ID,
      practiceArea: "wait_time",
    });
    goalProgressFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        goalId: "goal-wait",
        reportId: "r1",
        value: 3.2,
        createdAt: new Date("2026-04-29T10:00:00Z"),
        report: { summary: REPORT_SUMMARY_BASE },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-wait/progress",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<Record<string, unknown>>;
    expect(body[0].payload).toBeNull();
  });

  it("returns null payload when report.summary is missing (legacy reports)", async () => {
    goalFindFirst.mockResolvedValueOnce({
      id: "goal-dok-legacy",
      userId: TEST_USER_ID,
      practiceArea: "dok_mix",
    });
    goalProgressFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        goalId: "goal-dok-legacy",
        reportId: "r1",
        value: 0,
        createdAt: new Date("2026-04-29T10:00:00Z"),
        report: { summary: null },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-dok-legacy/progress",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<Record<string, unknown>>;
    expect(body[0].payload).toBeNull();
  });

  it("returns 404 when the goal belongs to a different user (IDOR guard)", async () => {
    goalFindFirst.mockResolvedValueOnce(null); // findFirst with userId filter → no row

    const otherUsersToken = await createAccessToken(OTHER_USER_ID, "other@school.edu");
    const response = await app.inject({
      method: "GET",
      url: "/goals/goal-belongs-to-someone-else/progress",
      headers: authHeader(otherUsersToken),
    });

    expect(response.statusCode).toBe(404);
    expect(goalFindFirst).toHaveBeenLastCalledWith({
      where: { id: "goal-belongs-to-someone-else", userId: OTHER_USER_ID },
    });
    expect(goalProgressFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ goalId: "goal-belongs-to-someone-else" }) })
    );
  });

  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/goals/anything/progress",
    });
    expect(response.statusCode).toBe(401);
  });
});
