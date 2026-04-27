import type {
  ParticipationDistribution,
  DiscoursePatterns,
  StudentReasoningResult,
  TranscriptSegment,
} from "@coachline/shared";

const REASONING_PATTERNS = [
  /\bbecause\b/i,
  /\bso\b/i,
  /\btherefore\b/i,
  /\bsince\b/i,
  /\bthat means\b/i,
  /\bwhich means\b/i,
  /\bthe text says\b/i,
  /\bin the diagram\b/i,
  /\bi know because\b/i,
  /\bi think.{1,30}because\b/i,
  /\bif.{1,30}then\b/i,
  /\bevidence\b/i,
];

interface DiarizedSegment {
  speaker: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface RawInsight {
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
}

// ── Participation Distribution ──────────────────────────────────────────────

export function computeParticipationDistribution(
  rawSegments: DiarizedSegment[],
  teacherSpeakerId: number
): ParticipationDistribution {
  const studentMs = new Map<number, number>();

  for (const seg of rawSegments) {
    if (seg.speaker === teacherSpeakerId) continue;
    const dur = seg.endMs - seg.startMs;
    studentMs.set(seg.speaker, (studentMs.get(seg.speaker) ?? 0) + dur);
  }

  const uniqueStudentVoices = studentMs.size;
  if (uniqueStudentVoices === 0) {
    return { uniqueStudentVoices: 0, giniCoefficient: null, top3SpeakersPercent: null };
  }

  const durations = Array.from(studentMs.values()).sort((a, b) => a - b);
  const total = durations.reduce((s, d) => s + d, 0);

  // Gini coefficient via the sorted-values formula:
  // G = (2 * Σ i·x_i - (n+1) * Σ x_i) / (n * Σ x_i)  where i is 1-indexed
  let giniCoefficient: number | null = null;
  if (uniqueStudentVoices > 1 && total > 0) {
    const n = durations.length;
    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
      weightedSum += (i + 1) * durations[i];
    }
    giniCoefficient =
      Math.round(((2 * weightedSum - (n + 1) * total) / (n * total)) * 1000) / 1000;
  }

  // Fraction of student talk time held by the top 3 most-talkative students.
  let top3SpeakersPercent: number | null = null;
  if (uniqueStudentVoices >= 3 && total > 0) {
    const topThree = [...durations].sort((a, b) => b - a).slice(0, 3);
    top3SpeakersPercent =
      Math.round((topThree.reduce((s, d) => s + d, 0) / total) * 1000) / 1000;
  }

  return { uniqueStudentVoices, giniCoefficient, top3SpeakersPercent };
}

// ── Discourse Patterns ──────────────────────────────────────────────────────

// Collapse consecutive same-speaker segments separated by ≤ 2 s into one turn
// so that Deepgram's fine-grained splits don't inflate turn counts.
function mergeTurns(
  segments: TranscriptSegment[]
): Array<{ speaker: "teacher" | "student"; startMs: number; endMs: number }> {
  const GAP_MS = 2000;
  const turns: Array<{ speaker: "teacher" | "student"; startMs: number; endMs: number }> = [];

  for (const seg of segments) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === seg.speaker && seg.startMs - last.endMs <= GAP_MS) {
      last.endMs = seg.endMs;
    } else {
      turns.push({ speaker: seg.speaker, startMs: seg.startMs, endMs: seg.endMs });
    }
  }

  return turns;
}

export function computeDiscoursePatterns(
  segments: TranscriptSegment[],
  insights: RawInsight[]
): DiscoursePatterns {
  const turns = mergeTurns(segments);

  let pingPong = 0;
  let volleyball = 0;
  let maxStudentChainLength = 0;
  let currentChain = 0;

  for (let i = 0; i < turns.length; i++) {
    if (turns[i].speaker !== "student") {
      currentChain = 0;
      continue;
    }

    currentChain++;
    if (currentChain > maxStudentChainLength) maxStudentChainLength = currentChain;

    const prev = turns[i - 1];
    if (prev?.speaker === "teacher") pingPong++;
    else if (prev?.speaker === "student") volleyball++;
  }

  const totalStudentTurns = turns.filter((t) => t.speaker === "student").length;
  const pingPongIndex =
    totalStudentTurns > 0 ? Math.round((pingPong / totalStudentTurns) * 1000) / 1000 : 0;
  const volleyballIndex =
    totalStudentTurns > 0 ? Math.round((volleyball / totalStudentTurns) * 1000) / 1000 : 0;

  const ireClosureRate = computeIreClosureRate(insights, segments);

  return { pingPongIndex, volleyballIndex, maxStudentChainLength, ireClosureRate };
}

// ── IRE Closure Rate ────────────────────────────────────────────────────────
// For each content question (open / closed / focusing) that received a student
// response within 30 s, check if an uptake move follows within 15 s of the
// response ending. Questions with no student response are excluded (they may
// be rhetorical or addressed to the room with no takers).
// Rate = non-uptake closures / questions-with-responses.

function computeIreClosureRate(
  insights: RawInsight[],
  segments: TranscriptSegment[]
): number | null {
  const contentQuestions = insights.filter(
    (i) =>
      i.type === "question_open" ||
      i.type === "question_closed" ||
      i.type === "question_focusing"
  );
  if (contentQuestions.length === 0) return null;

  const uptakes = insights.filter((i) => i.type === "uptake");

  let withResponse = 0;
  let ireCloses = 0;

  for (const q of contentQuestions) {
    const nextStudent = segments.find(
      (s) => s.speaker === "student" && s.startMs >= q.endMs && s.startMs < q.endMs + 30_000
    );
    if (!nextStudent) continue;

    withResponse++;

    const hasUptake = uptakes.some(
      (u) => u.startMs >= nextStudent.endMs && u.startMs < nextStudent.endMs + 15_000
    );
    if (!hasUptake) ireCloses++;
  }

  if (withResponse === 0) return null;
  return Math.round((ireCloses / withResponse) * 1000) / 1000;
}

export function computeStudentReasoning(
  segments: TranscriptSegment[],
  insights: RawInsight[]
): StudentReasoningResult {
  const studentSegments = segments.filter((s) => s.speaker === "student");
  const totalStudentTurnCount = studentSegments.length;

  if (totalStudentTurnCount === 0) {
    return { reasoningTurnCount: 0, totalStudentTurnCount: 0, reasoningRatio: null, topTriggeringMoveType: null };
  }

  const uptakes = insights.filter((i) => i.type === "uptake");
  const triggerCounts = new Map<string, number>();
  let reasoningTurnCount = 0;

  for (const seg of studentSegments) {
    const isReasoning = REASONING_PATTERNS.some((p) => p.test(seg.text));
    if (!isReasoning) continue;

    reasoningTurnCount++;

    const preceding = uptakes
      .filter((u) => u.endMs <= seg.startMs && seg.startMs - u.endMs < 10_000)
      .sort((a, b) => b.endMs - a.endMs)[0];

    if (preceding) {
      const moveType = (preceding.metadata as { uptakeType?: string }).uptakeType ?? "unknown";
      triggerCounts.set(moveType, (triggerCounts.get(moveType) ?? 0) + 1);
    }
  }

  let topTriggeringMoveType: string | null = null;
  let topCount = 0;
  for (const [type, count] of triggerCounts) {
    if (count > topCount) { topCount = count; topTriggeringMoveType = type; }
  }

  return {
    reasoningTurnCount,
    totalStudentTurnCount,
    reasoningRatio: Math.round((reasoningTurnCount / totalStudentTurnCount) * 1000) / 1000,
    topTriggeringMoveType,
  };
}
