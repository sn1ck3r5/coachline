import type { TranscriptSegment } from "@coachline/shared";

const MIN_TEACHER_WORDS = 50;

function countSyllablesInWord(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:e|es|ed)$/, "");
  const groups = trimmed.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 0;
}

function countWords(text: string): number {
  const matches = text.match(/\b[\w']+\b/g);
  return matches ? matches.length : 0;
}

function countSyllables(text: string): number {
  const words = text.match(/\b[\w']+\b/g) || [];
  let total = 0;
  for (const word of words) total += countSyllablesInWord(word);
  return total;
}

/**
 * Flesch-Kincaid Grade Level for teacher talk only.
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 * Returns null when there's too little teacher speech to reason about
 * (< 50 words), or when sentence/word counts make the formula degenerate.
 */
export function computeTeacherFleschKincaid(
  segments: TranscriptSegment[]
): number | null {
  const teacherText = segments
    .filter((s) => s.speaker === "teacher")
    .map((s) => s.text.trim())
    .join(" ");
  if (!teacherText) return null;

  const words = countWords(teacherText);
  if (words < MIN_TEACHER_WORDS) return null;

  // If the transcript has no sentence-final punctuation, fall back to
  // treating the whole thing as one long sentence rather than dividing
  // by zero.
  const sentences = Math.max(1, countSentences(teacherText));
  const syllables = countSyllables(teacherText);
  if (syllables === 0) return null;

  const fk =
    0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  // Round to one decimal for display; the formula is not more precise
  // than that anyway.
  return Math.round(fk * 10) / 10;
}
