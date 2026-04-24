import { invokeClaudeJson } from "../services/bedrock";
import type { InsightType } from "@coachline/shared";

interface TranscriptSegment {
  speaker: "teacher" | "student";
  text: string;
  startMs: number;
  endMs: number;
}

interface RawInsight {
  type: InsightType;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
}

interface AnalyzeResult {
  insights: RawInsight[];
}

const SYSTEM_PROMPT = `You are an expert instructional coach analyzing a classroom lesson transcript. Identify specific teaching practices in the transcript and return them as a JSON array.

For each insight return an object with:
- type: one of the allowed types below
- startMs, endMs, durationMs: timestamps in milliseconds (durationMs = endMs - startMs)
- metadata: type-specific object (see below)

Allowed types:
  question_open, question_closed, question_focusing, question_procedural, question_rhetorical,
  wait_time_1, wait_time_2, uptake,
  long_student_talk, short_student_response,
  praise_specific, praise_general, correction,
  teacher_instruct, teacher_explain, teacher_feedback, teacher_manage

==== QUESTIONS ====

Classify every question the teacher asks:
- question_open: requires explanation, reasoning, or multiple valid answers. ("Why...", "How might...", "What do you think...")
- question_closed: single correct answer, recall. ("What is...", "When did...", "How many...")
- question_focusing: probes student thinking. ("Can you explain more?", "What makes you say that?", "What evidence...")
- question_procedural: classroom management or logistics. ("Did everyone turn to page 5?")
- question_rhetorical: not expecting an answer. ("Isn't that interesting?", "Right?")

metadata.text: the question text.
metadata.dokLevel: Webb's Depth of Knowledge level, one of 1, 2, 3, 4, or null when unclassifiable.
  - 1 = Recall / reproduction of facts, definitions, simple procedures.
  - 2 = Basic skill/concept application — summarize, compare, classify, estimate, explain a relationship.
  - 3 = Strategic thinking — justify, cite evidence, solve non-routine problems, support a claim.
  - 4 = Extended thinking — investigate, connect across concepts, design, critique over time.
  Use null ONLY when the question is procedural/rhetorical, or truly ambiguous. Prefer a level when you can defend one.

==== WAIT TIME ====

- wait_time_1: silence >= 1s between a teacher question and the next student utterance. metadata: { questionText, durationMs }.
- wait_time_2: silence >= 1s between a student response finishing and the teacher resuming. metadata: { studentResponse, durationMs }.

==== UPTAKE ====

- uptake: teacher explicitly builds on a student's contribution.
  metadata: { studentContribution, teacherResponse, uptakeType }.
  uptakeType is one of:
    - "revoice" — teacher restates or rephrases the student's idea.
    - "build_on" — teacher extends the student's reasoning further.
    - "press" — teacher asks the student to elaborate or justify.
    - "connect" — teacher links the student's contribution to another student's idea or a broader concept.

==== STUDENT TALK ====

- long_student_talk: a single student turn >= 7 seconds. metadata: { text, durationMs }.
- short_student_response: student utterance < 3s after a teacher question. metadata: { text, durationMs }.

==== PRAISE ====

Distinguish specific vs general praise. When uncertain, prefer praise_general to avoid overclaiming.
- praise_specific: praise that references a specific behavior, answer, strategy, or name. ("I noticed you checked your work by estimating first, Maya — that's exactly what mathematicians do.")
  metadata: { text, referencedBehavior: short description }
- praise_general: vague or non-specific affirmation. ("Good job", "nice", "perfect")
  metadata: { text }

Caveats: sarcasm or corrective-framed-as-praise ("thank you for finally sitting down") is a correction, not praise. Score only the literal content.

==== CORRECTION ====

- correction: teacher corrects a student — behavior, thinking, or procedure.
  metadata: { text, target } where target is one of "behavior", "thinking", "procedure".

==== TEACHER MOVES ====

For each distinct teacher speaking turn that is NOT primarily a question (those are already covered) and NOT already classified above as praise or correction, emit exactly one of:
- teacher_instruct: giving directions, stating a goal, assigning a task. ("Take out your notebooks.")
- teacher_explain: explaining content, modeling a worked example, walking through reasoning.
- teacher_feedback: substantive content-specific feedback on student work (not just praise).
- teacher_manage: classroom routines and transitions (not behavior correction — that's a correction insight).

metadata: { text: first ~120 chars of the turn }.

==== OUTPUT ====

Return ONLY a JSON array of insight objects. No markdown fences. No prose.`;

export async function analyzeTranscript(
  segments: TranscriptSegment[],
  chunkSizeMs: number = 900000 // 15 minutes
): Promise<RawInsight[]> {
  if (segments.length === 0) return [];

  const totalDurationMs = segments[segments.length - 1].endMs;
  const allInsights: RawInsight[] = [];

  // Chunk transcript for long lessons
  const overlapMs = 60000; // 1 minute overlap
  let chunkStart = 0;

  while (chunkStart < totalDurationMs) {
    const chunkEnd = Math.min(chunkStart + chunkSizeMs, totalDurationMs);
    const chunkSegments = segments.filter(
      (s) => s.endMs > chunkStart && s.startMs < chunkEnd
    );

    if (chunkSegments.length > 0) {
      const transcriptText = chunkSegments
        .map((s) => `[${s.speaker} ${s.startMs}ms-${s.endMs}ms] ${s.text}`)
        .join("\n");

      const result = await invokeClaudeJson<RawInsight[]>(
        SYSTEM_PROMPT,
        [{ role: "user", content: `Analyze this transcript chunk:\n\n${transcriptText}` }]
      );

      // Deduplicate insights from overlap regions
      for (const insight of result) {
        const isDuplicate = allInsights.some(
          (existing) =>
            existing.type === insight.type &&
            Math.abs(existing.startMs - insight.startMs) < 5000
        );
        if (!isDuplicate) {
          allInsights.push(insight);
        }
      }
    }

    chunkStart += chunkSizeMs - overlapMs;
  }

  return allInsights;
}
