import { describe, it, expect } from "vitest";
import {
  computeParticipationDistribution,
  computeDiscoursePatterns,
} from "../../src/pipeline/discourse";
import type { TranscriptSegment } from "@coachline/shared";

// ── Helpers ──────────────────────────────────────────────────────────────────

function seg(
  speaker: "teacher" | "student",
  startMs: number,
  endMs: number,
  text = ""
): TranscriptSegment {
  return { speaker, startMs, endMs, text, type: speaker === "teacher" ? "teacher_talk" : "student_talk" };
}

function raw(speaker: number, startMs: number, endMs: number) {
  return { speaker, startMs, endMs, text: "" };
}

// ── computeParticipationDistribution ─────────────────────────────────────────

describe("computeParticipationDistribution", () => {
  it("returns zero voices when only teacher speaks", () => {
    const segs = [raw(0, 0, 5000), raw(0, 5000, 10000)];
    const result = computeParticipationDistribution(segs, 0);
    expect(result.uniqueStudentVoices).toBe(0);
    expect(result.giniCoefficient).toBeNull();
    expect(result.top3SpeakersPercent).toBeNull();
  });

  it("counts unique student speaker IDs correctly", () => {
    const segs = [
      raw(0, 0, 5000),   // teacher
      raw(1, 5000, 7000), // student 1
      raw(2, 7000, 9000), // student 2
      raw(3, 9000, 10000), // student 3
    ];
    const result = computeParticipationDistribution(segs, 0);
    expect(result.uniqueStudentVoices).toBe(3);
  });

  it("gini = 0 when all students talk equally", () => {
    const segs = [
      raw(1, 0, 2000),
      raw(2, 2000, 4000),
      raw(3, 4000, 6000),
    ];
    const result = computeParticipationDistribution(segs, 99);
    // Equal durations → Gini = 0
    expect(result.giniCoefficient).toBe(0);
  });

  it("gini approaches 1 when one student dominates", () => {
    const segs = [
      raw(1, 0, 100),      // 100ms
      raw(2, 100, 200),    // 100ms
      raw(3, 200, 10200),  // 10000ms — dominates
    ];
    const result = computeParticipationDistribution(segs, 99);
    // Not null, and clearly > 0.5
    expect(result.giniCoefficient).not.toBeNull();
    expect(result.giniCoefficient!).toBeGreaterThan(0.5);
  });

  it("top3SpeakersPercent is null when fewer than 3 student voices", () => {
    const segs = [raw(1, 0, 2000), raw(2, 2000, 4000)];
    const result = computeParticipationDistribution(segs, 99);
    expect(result.top3SpeakersPercent).toBeNull();
  });

  it("top3SpeakersPercent is 1.0 when only 3 students speak", () => {
    const segs = [
      raw(1, 0, 2000),
      raw(2, 2000, 4000),
      raw(3, 4000, 6000),
    ];
    const result = computeParticipationDistribution(segs, 99);
    expect(result.top3SpeakersPercent).toBe(1);
  });
});

// ── computeDiscoursePatterns ──────────────────────────────────────────────────

describe("computeDiscoursePatterns", () => {
  it("pure ping-pong: all student turns follow teacher turns", () => {
    const segments = [
      seg("teacher", 0, 2000),
      seg("student", 2000, 4000),
      seg("teacher", 4000, 6000),
      seg("student", 6000, 8000),
    ];
    const result = computeDiscoursePatterns(segments, []);
    expect(result.pingPongIndex).toBe(1);
    expect(result.volleyballIndex).toBe(0);
    expect(result.maxStudentChainLength).toBe(1);
  });

  it("detects student-to-student volleyball exchanges", () => {
    // Gap between the two student segments must be > 2000ms to avoid merging.
    const segments = [
      seg("teacher", 0, 2000),
      seg("student", 2000, 4000),
      seg("student", 6100, 8000), // 2100ms gap — not merged; volleyball
      seg("teacher", 8000, 10000),
      seg("student", 10000, 11000),
    ];
    // Student turns: 3 total. S1 follows T → ping-pong. S2 follows S → volleyball. S3 follows T → ping-pong.
    const result = computeDiscoursePatterns(segments, []);
    expect(result.pingPongIndex).toBeCloseTo(2 / 3, 2);
    expect(result.volleyballIndex).toBeCloseTo(1 / 3, 2);
    expect(result.maxStudentChainLength).toBe(2);
  });

  it("merges same-speaker segments within 2s gap before counting turns", () => {
    // Two student segments 1.5s apart — should be treated as one turn
    const segments = [
      seg("teacher", 0, 2000),
      seg("student", 2000, 3000),
      seg("student", 4000, 5000), // 1s gap — merged with previous
    ];
    const result = computeDiscoursePatterns(segments, []);
    expect(result.maxStudentChainLength).toBe(1); // one merged turn
    expect(result.pingPongIndex).toBe(1);
  });

  it("ireClosureRate is null when no content questions", () => {
    const segments = [seg("teacher", 0, 2000), seg("student", 2000, 4000)];
    const insights = [
      { type: "question_procedural", startMs: 0, endMs: 2000, durationMs: 2000, metadata: {} },
    ];
    const result = computeDiscoursePatterns(segments, insights);
    expect(result.ireClosureRate).toBeNull();
  });

  it("ireClosureRate is 0 when all questions have uptake followups", () => {
    const segments = [
      seg("teacher", 0, 2000),
      seg("student", 2000, 4000),
      seg("teacher", 4000, 6000), // uptake response
    ];
    const insights = [
      { type: "question_open", startMs: 0, endMs: 2000, durationMs: 2000, metadata: {} },
      { type: "uptake", startMs: 4000, endMs: 6000, durationMs: 2000, metadata: {} },
    ];
    const result = computeDiscoursePatterns(segments, insights);
    expect(result.ireClosureRate).toBe(0);
  });

  it("ireClosureRate is 1 when no uptake after any response", () => {
    const segments = [
      seg("teacher", 0, 2000),
      seg("student", 2000, 4000),
      seg("teacher", 4000, 6000), // teacher responds but no uptake insight
    ];
    const insights = [
      { type: "question_open", startMs: 0, endMs: 2000, durationMs: 2000, metadata: {} },
      // no uptake insight
    ];
    const result = computeDiscoursePatterns(segments, insights);
    expect(result.ireClosureRate).toBe(1);
  });

  it("ireClosureRate excludes questions with no student response", () => {
    const segments = [
      seg("teacher", 0, 2000),
      // no student segment within 30s
    ];
    const insights = [
      { type: "question_open", startMs: 0, endMs: 2000, durationMs: 2000, metadata: {} },
    ];
    const result = computeDiscoursePatterns(segments, insights);
    expect(result.ireClosureRate).toBeNull(); // 0 questions with responses
  });
});
