import { describe, it, expect } from "vitest";
import { computeTeacherFleschKincaid } from "../../src/pipeline/readability";
import type { TranscriptSegment } from "@coachline/shared";

function teacherSeg(text: string): TranscriptSegment {
  return { speaker: "teacher", text, startMs: 0, endMs: 1000, type: "teacher_talk" };
}
function studentSeg(text: string): TranscriptSegment {
  return { speaker: "student", text, startMs: 0, endMs: 1000, type: "student_talk" };
}

describe("computeTeacherFleschKincaid", () => {
  it("returns null when there's no teacher speech", () => {
    expect(computeTeacherFleschKincaid([])).toBeNull();
    expect(computeTeacherFleschKincaid([studentSeg("the cat sat on the mat")])).toBeNull();
  });

  it("returns null when teacher speech is shorter than 50 words", () => {
    const short = teacherSeg("Okay, let's begin. Take out your books.");
    expect(computeTeacherFleschKincaid([short])).toBeNull();
  });

  it("computes a low grade for simple early-elementary speech", () => {
    // ~60 words of short, one-syllable-dominant speech.
    const simple = teacherSeg(
      "Okay, class, sit down now. Look up at me. We are going to read a short story. Pick up your book. Open it to page three. Point to the first word. Read it out loud. Now read the next word. Good job. Keep going. Read the whole line. Stop at the dot. Look up."
    );
    const fk = computeTeacherFleschKincaid([simple]);
    expect(fk).not.toBeNull();
    expect(fk!).toBeLessThan(4);
  });

  it("computes a higher grade for more complex academic speech", () => {
    const complex = teacherSeg(
      "The mitochondrion functions as the principal energy-transducing organelle within eukaryotic cells, orchestrating oxidative phosphorylation through an intricate electron transport chain. Metabolic intermediates derived from glycolytic pathways are systematically channeled into the citric acid cycle, where they undergo sequential enzymatic transformations. Understanding these biochemical mechanisms requires careful consideration of compartmentalization, proton gradients, and allosteric regulation of the participating enzymes."
    );
    const fk = computeTeacherFleschKincaid([complex]);
    expect(fk).not.toBeNull();
    expect(fk!).toBeGreaterThan(10);
  });

  it("ignores student segments when computing teacher FK", () => {
    const teacher = teacherSeg(
      "Okay class, open your notebooks to the page about fractions. We are going to practice adding simple fractions together. Remember to find a common bottom number before you add the top numbers. Let's try the first problem on the board together. What is one half plus one quarter? Think about it for a moment before you shout out your answer. I want to see at least five hands raised."
    );
    const student = studentSeg(
      "Supercalifragilistic pseudopharmacological neurobiological multisyllabic vocabulary demonstrating sesquipedalian tendencies throughout extensive dialectical discourse."
    );
    const fkTeacherOnly = computeTeacherFleschKincaid([teacher]);
    const fkMixed = computeTeacherFleschKincaid([teacher, student]);
    expect(fkMixed).toBe(fkTeacherOnly);
  });
});
