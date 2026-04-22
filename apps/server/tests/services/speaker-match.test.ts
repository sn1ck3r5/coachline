import { describe, it, expect } from "vitest";
import { identifyTeacherSpeaker, computeSpeakerStats } from "../../src/services/speaker-match";

describe("identifyTeacherSpeaker", () => {
  it("identifies dominant speaker as teacher", () => {
    const speakerStats = [
      { speakerId: 0, totalMs: 20000 },
      { speakerId: 1, totalMs: 8000 },
      { speakerId: 2, totalMs: 3000 },
    ];

    expect(identifyTeacherSpeaker(speakerStats)).toBe(0);
  });

  it("handles single speaker", () => {
    expect(identifyTeacherSpeaker([{ speakerId: 0, totalMs: 45000 }])).toBe(0);
  });
});

describe("computeSpeakerStats", () => {
  it("aggregates talk time per speaker", () => {
    const segments = [
      { speaker: 0, startMs: 0, endMs: 5000 },
      { speaker: 1, startMs: 5000, endMs: 8000 },
      { speaker: 0, startMs: 8000, endMs: 12000 },
    ];
    const stats = computeSpeakerStats(segments);
    const speaker0 = stats.find((s) => s.speakerId === 0)!;
    expect(speaker0.totalMs).toBe(9000);
  });
});
