import { describe, it, expect } from "vitest";
import { classifySegments } from "../../src/pipeline/classify";

describe("classifySegments", () => {
  it("calculates talk time percentages", () => {
    const segments = [
      { speaker: 0, startMs: 0, endMs: 10000, text: "Teacher speaking" },
      { speaker: 1, startMs: 10000, endMs: 15000, text: "Student response" },
      { speaker: 0, startMs: 18000, endMs: 25000, text: "More teacher" },
    ];

    const result = classifySegments(segments, 0, 25000);

    expect(result.talkTime.teacherPercent).toBeCloseTo(68, 0); // 17000/25000
    expect(result.talkTime.studentPercent).toBeCloseTo(20, 0); // 5000/25000
    expect(result.talkTime.silencePercent).toBeCloseTo(12, 0); // 3000/25000
  });

  it("detects silence gaps", () => {
    const segments = [
      { speaker: 0, startMs: 0, endMs: 5000, text: "Question?" },
      { speaker: 1, startMs: 9000, endMs: 12000, text: "Answer" },
    ];

    const result = classifySegments(segments, 0, 12000);

    const silenceSegments = result.timeline.filter((s) => s.type === "silence");
    expect(silenceSegments).toHaveLength(1);
    expect(silenceSegments[0].startMs).toBe(5000);
    expect(silenceSegments[0].endMs).toBe(9000);
  });

  it("detects group talk from overlapping speakers", () => {
    const segments = [
      { speaker: 1, startMs: 0, endMs: 5000, text: "Student A" },
      { speaker: 2, startMs: 2000, endMs: 6000, text: "Student B" },
    ];

    const result = classifySegments(segments, 0, 6000);

    expect(result.talkTime.groupPercent).toBeGreaterThan(0);
  });
});
