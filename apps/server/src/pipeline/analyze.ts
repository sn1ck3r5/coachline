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

const SYSTEM_PROMPT = `You are an expert instructional coach analyzing a classroom lesson transcript. Your job is to identify specific teaching practices in the transcript and return them as structured JSON.

For each practice you detect, return an object with:
- type: one of "question_open", "question_closed", "question_focusing", "question_procedural", "question_rhetorical", "wait_time_1", "wait_time_2", "uptake", "long_student_talk", "short_student_response"
- startMs: start timestamp in milliseconds
- endMs: end timestamp in milliseconds
- durationMs: endMs - startMs
- metadata: an object with type-specific details

Type-specific metadata:
- question_*: { "text": "the question text" }
- wait_time_1: { "questionText": "preceding question", "durationMs": silence duration }
- wait_time_2: { "studentResponse": "what student said", "durationMs": silence duration }
- uptake: { "studentContribution": "what student said", "teacherResponse": "how teacher built on it" }
- long_student_talk: { "text": "what student said", "durationMs": how long }
- short_student_response: { "text": "what student said", "durationMs": how long }

Question classification guide:
- open: requires explanation, reasoning, or multiple valid answers ("Why...", "How might...", "What do you think...")
- closed: single correct answer, recall ("What is...", "When did...", "How many...")
- focusing: probes student thinking ("Can you explain more?", "What makes you say that?", "What evidence...")
- procedural: classroom management ("Did everyone turn to page 5?", "Who needs more time?")
- rhetorical: not expecting an answer ("Isn't that interesting?", "Right?")

Wait time thresholds:
- wait_time_1: silence >= 1 second between teacher question and student response
- wait_time_2: silence >= 1 second between student response and teacher's next utterance

Student talk thresholds:
- long_student_talk: student speaking >= 7 seconds
- short_student_response: student speaking < 3 seconds (only after a teacher question)

Return ONLY a JSON array of insight objects. No other text.`;

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
