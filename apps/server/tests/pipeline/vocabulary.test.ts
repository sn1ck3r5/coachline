import { describe, it, expect } from "vitest";
import { computeAcademicLanguage } from "../../src/pipeline/vocabulary";
import type { TranscriptSegment } from "@coachline/shared";

function tseg(text: string, startMs = 0, endMs = 5000): TranscriptSegment {
  return { speaker: "teacher", text, startMs, endMs, type: "teacher_talk" };
}

describe("computeAcademicLanguage", () => {
  it("returns empty summary when no teacher segments", () => {
    const result = computeAcademicLanguage([]);
    expect(result.tier2Count).toBe(0);
    expect(result.tier2Words).toHaveLength(0);
    expect(result.definitionRate).toBeNull();
  });

  it("detects tier 2 words in teacher speech", () => {
    const result = computeAcademicLanguage([
      tseg("We will analyze and evaluate the results."),
    ]);
    expect(result.tier2Words.map((w) => w.word)).toContain("analyze");
    expect(result.tier2Words.map((w) => w.word)).toContain("evaluate");
    expect(result.tier2Count).toBeGreaterThanOrEqual(2);
  });

  it("counts multiple occurrences of the same word", () => {
    const result = computeAcademicLanguage([
      tseg("Analyze the data. Did you analyze correctly?"),
    ]);
    const analyzeEntry = result.tier2Words.find((w) => w.word === "analyze");
    expect(analyzeEntry?.count).toBe(2);
  });

  it("flags a word as defined in context when followed by a definition phrase", () => {
    const result = computeAcademicLanguage([
      tseg("Denominator — that's the bottom number of the fraction."),
    ]);
    const entry = result.tier2Words.find((w) => w.word === "denominator");
    expect(entry?.definedInContext).toBe(true);
  });

  it("computes definitionRate correctly", () => {
    const result = computeAcademicLanguage([
      tseg("Analyze means to break something apart. We will also evaluate."),
    ]);
    const defined = result.tier2Words.filter((w) => w.definedInContext).length;
    const total = result.tier2Words.length;
    expect(result.definitionRate).toBeCloseTo(defined / total, 2);
  });
});
