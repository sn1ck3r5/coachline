# Evidence-Backed Lesson Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 3-zone lesson report redesign (Coach → The Room → Full Data) with 6 new research-backed metric cards, 4 new backend pipeline signals, and 3 new goal practice areas.

**Architecture:** Backend-first (Tasks 1–8) adds the 4 missing signals (Student Reasoning, Lesson Launch, Question Quality funneling/focusing, Academic Language) to the pipeline with no schema migrations. UI-second (Tasks 9–14) restructures the existing flat lesson report page into the 3-zone layout with intent-surfaced card promotion.

**Tech Stack:** TypeScript, Fastify, Next.js 16 App Router, Tailwind CSS v4, Vitest, Prisma, `@coachline/shared` workspace package.

---

## File Map

**Backend — modified:**
- `packages/shared/src/types/report.ts` — 4 new metric interfaces; add to `ReportSummary`
- `packages/shared/src/constants.ts` — 3 new `PRACTICE_AREAS` entries
- `packages/shared/src/index.ts` — export new types
- `apps/server/src/pipeline/discourse.ts` — add `computeStudentReasoning`
- `apps/server/src/pipeline/analyze.ts` — add `lesson_launch` insight type + `focusingType` sub-field on `question_open`
- `apps/server/src/pipeline/report.ts` — update LLM prompt + `GenerateReportInput` + `baseSummary`
- `apps/server/src/pipeline/orchestrator.ts` — call `vocabulary.ts`, thread new data to report, update `computeGoalMetric`

**Backend — created:**
- `apps/server/src/pipeline/vocabulary.ts` — `computeAcademicLanguage` function

**Tests — modified:**
- `apps/server/tests/pipeline/discourse.test.ts` — student reasoning tests

**Tests — created:**
- `apps/server/tests/pipeline/vocabulary.test.ts` — academic language tests

**Web UI — modified:**
- `apps/server/web/src/app/(dashboard)/lessons/[id]/page.tsx` — restructure into 3-zone layout
- `apps/server/web/src/app/(dashboard)/goals/page.tsx` — add 3 new practice areas + labels

**Web UI — created:**
- `apps/server/web/src/lib/intent-cards.ts` — intent → focus card mapping
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone1.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone2.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone3.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/EquityOfVoiceCard.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/DialogueFlowCard.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/StudentReasoningCard.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/LessonLaunchCard.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/QuestionQualityCard.tsx`
- `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/AcademicLanguageCard.tsx`

---

## Task 1: Shared types — 4 new metric interfaces + 3 new practice areas

**Files:**
- Modify: `packages/shared/src/types/report.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add 4 new metric interfaces to `packages/shared/src/types/report.ts`**

Add after the `VocabGradeLevel` interface (before `NextMove`):

```typescript
export interface LessonLaunchCheck {
  detected: boolean;
  timestampMs: number | null;
  quote: string | null;
}

export interface LessonLaunchScore {
  score: number; // 0–3: count of elements detected
  learningIntention: LessonLaunchCheck;
  successCriteria: LessonLaunchCheck;
  relevanceHook: LessonLaunchCheck;
}

export interface QuestionQualityBreakdown {
  focusing: number;
  funneling: number;
  // focusing / (focusing + funneling); null when no open questions
  focusingRatio: number | null;
}

export interface StudentReasoningResult {
  reasoningTurnCount: number;
  totalStudentTurnCount: number;
  // reasoningTurnCount / totalStudentTurnCount; null when no student turns
  reasoningRatio: number | null;
  // which uptake type most often immediately preceded a reasoning student turn
  topTriggeringMoveType: string | null;
}

export interface Tier2WordUsage {
  word: string;
  count: number;
  definedInContext: boolean;
}

export interface AcademicLanguageSummary {
  tier2Words: Tier2WordUsage[];
  tier2Count: number;
  // (words defined in context) / tier2Count; null when tier2Count === 0
  definitionRate: number | null;
}
```

- [ ] **Step 2: Add the 4 new fields to `ReportSummary`**

Add after `vocabGradeLevel` and before `participationDistribution`:

```typescript
lessonLaunch: LessonLaunchScore | null;
questionQuality: QuestionQualityBreakdown;
studentReasoning: StudentReasoningResult;
academicLanguage: AcademicLanguageSummary;
```

- [ ] **Step 3: Add 3 new entries to `PRACTICE_AREAS` in `packages/shared/src/constants.ts`**

Change:
```typescript
export const PRACTICE_AREAS = [
  "wait_time", "open_questions", "student_talk_ratio", "uptake",
  "dok_mix", "praise_ratio", "vocab_match", "custom",
] as const;
```
To:
```typescript
export const PRACTICE_AREAS = [
  "wait_time", "open_questions", "student_talk_ratio", "uptake",
  "dok_mix", "praise_ratio", "vocab_match",
  "equity_of_voice", "dialogue_quality", "lesson_clarity",
  "custom",
] as const;
```

- [ ] **Step 4: Export new types from `packages/shared/src/index.ts`**

Add to the report types export block:
```typescript
export type {
  // ...existing exports...
  LessonLaunchCheck,
  LessonLaunchScore,
  QuestionQualityBreakdown,
  StudentReasoningResult,
  Tier2WordUsage,
  AcademicLanguageSummary,
} from "./types/report";
```

- [ ] **Step 5: Run typecheck to verify no regressions**

```bash
npm run typecheck
```
Expected: all packages pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/report.ts packages/shared/src/constants.ts packages/shared/src/index.ts
git commit -m "feat(shared): add 4 new metric types and 3 new practice areas"
```

---

## Task 2: Student Reasoning — linguistic marker scan

**Files:**
- Modify: `apps/server/src/pipeline/discourse.ts`
- Modify: `apps/server/tests/pipeline/discourse.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/server/tests/pipeline/discourse.test.ts`:

```typescript
import { computeStudentReasoning } from "../../src/pipeline/discourse";

// helper already defined at top of file: seg(speaker, startMs, endMs, text)

describe("computeStudentReasoning", () => {
  it("returns null ratio when no student segments", () => {
    const result = computeStudentReasoning([], []);
    expect(result.totalStudentTurnCount).toBe(0);
    expect(result.reasoningRatio).toBeNull();
    expect(result.topTriggeringMoveType).toBeNull();
  });

  it("counts turns containing causal language", () => {
    const segments = [
      seg("student", 0, 3000, "I think it's 4"),
      seg("student", 3000, 7000, "because the denominator stays the same"),
      seg("student", 7000, 10000, "right"),
    ];
    const result = computeStudentReasoning(segments, []);
    expect(result.totalStudentTurnCount).toBe(3);
    expect(result.reasoningTurnCount).toBe(1); // only "because..." turn
    expect(result.reasoningRatio).toBeCloseTo(1 / 3, 2);
  });

  it("detects 'therefore', 'since', 'the text says' as reasoning markers", () => {
    const segments = [
      seg("student", 0, 4000, "therefore we need to find the LCM"),
      seg("student", 5000, 8000, "since both are even"),
      seg("student", 9000, 12000, "the text says they migrate"),
    ];
    const result = computeStudentReasoning(segments, []);
    expect(result.reasoningTurnCount).toBe(3);
  });

  it("identifies top triggering move type from preceding uptake insights", () => {
    const segments = [
      seg("student", 2000, 5000, "because the numerators add"),
      seg("student", 8000, 11000, "so we multiply both sides"),
    ];
    const insights = [
      { type: "uptake", startMs: 0, endMs: 2000, durationMs: 2000, metadata: { uptakeType: "press" } },
      { type: "uptake", startMs: 6000, endMs: 8000, durationMs: 2000, metadata: { uptakeType: "press" } },
    ];
    const result = computeStudentReasoning(segments, insights);
    expect(result.topTriggeringMoveType).toBe("press");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run apps/server/tests/pipeline/discourse.test.ts 2>&1 | grep -E "FAIL|PASS|error"
```
Expected: FAIL — `computeStudentReasoning` not exported.

- [ ] **Step 3: Implement `computeStudentReasoning` in `discourse.ts`**

Add after `computeDiscoursePatterns`. First add these constants near the top of the file (after the imports):

```typescript
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
```

Then add the function:

```typescript
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

  // Count which uptake move type most often preceded a reasoning student turn
  const triggerCounts = new Map<string, number>();
  let reasoningTurnCount = 0;

  for (const seg of studentSegments) {
    const isReasoning = REASONING_PATTERNS.some((p) => p.test(seg.text));
    if (!isReasoning) continue;

    reasoningTurnCount++;

    // Find the closest uptake that ended just before this student turn
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
```

Also add the import for `StudentReasoningResult` at the top of `discourse.ts`:
```typescript
import type {
  ParticipationDistribution,
  DiscoursePatterns,
  StudentReasoningResult,
  TranscriptSegment,
} from "@coachline/shared";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run apps/server/tests/pipeline/discourse.test.ts
```
Expected: all tests pass (existing 13 + new 4 = 17 total).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/pipeline/discourse.ts apps/server/tests/pipeline/discourse.test.ts
git commit -m "feat(pipeline): student reasoning linguistic marker scan"
```

---

## Task 3: Academic Language — Tier 2 word detection

**Files:**
- Create: `apps/server/src/pipeline/vocabulary.ts`
- Create: `apps/server/tests/pipeline/vocabulary.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `apps/server/tests/pipeline/vocabulary.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run apps/server/tests/pipeline/vocabulary.test.ts 2>&1 | grep -E "FAIL|cannot find"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/pipeline/vocabulary.ts`**

```typescript
import type { AcademicLanguageSummary, Tier2WordUsage, TranscriptSegment } from "@coachline/shared";

// Curated subset of the Academic Word List (Coxhead 2000) — 200 high-frequency
// Tier 2 words common across subject areas. Lowercase, base forms only.
const TIER2_WORDS = new Set([
  "analyze", "analyse", "approach", "area", "assess", "assume", "authority",
  "available", "benefit", "concept", "consist", "context", "contract", "create",
  "data", "define", "derive", "distribute", "economy", "environment", "establish",
  "estimate", "evaluate", "evidence", "export", "factor", "feature", "final",
  "focus", "function", "identify", "indicate", "interpret", "issue", "labor",
  "legal", "major", "method", "occur", "percent", "period", "policy", "principle",
  "procedure", "process", "require", "research", "respond", "role", "section",
  "significant", "similar", "source", "specific", "structure", "theory", "vary",
  "appropriate", "category", "complex", "component", "consequence", "constitute",
  "construct", "contribute", "coordinate", "criteria", "decade", "demonstrate",
  "document", "domain", "effect", "element", "energy", "equation", "equivalent",
  "exist", "formula", "foundation", "generate", "hypothesis", "impact", "implement",
  "implication", "individual", "influence", "initial", "instance", "integrate",
  "investigate", "justify", "layer", "mechanism", "minimum", "objective",
  "obtain", "participate", "perceive", "phase", "primary", "proportion",
  "reaction", "region", "regulate", "relate", "relevant", "rely", "represent",
  "require", "resource", "series", "shift", "significant", "strategy", "sufficient",
  "summarize", "support", "technical", "transfer", "transform", "contrast",
  "compare", "classify", "predict", "describe", "explain", "illustrate",
  "infer", "modify", "observe", "organize", "sequence", "synthesize",
  "vocabulary", "comprehension", "analysis", "synthesis", "inference",
  "argument", "claim", "cite", "evidence", "reasoning", "conclusion",
  "perspective", "viewpoint", "justify", "elaborate", "clarify",
  // domain-overlap Tier 2/3
  "denominator", "numerator", "equation", "variable", "coefficient",
  "hypothesis", "organism", "habitat", "ecosystem", "phenomenon",
  "democracy", "constitution", "revolution", "migration", "civilization",
  "protagonist", "antagonist", "narrative", "metaphor", "symbolism",
  "inference", "theme", "perspective", "genre", "fluency",
]);

// Patterns that suggest a teacher defined the preceding word in-context.
// Matches constructs like: "word — that's...", "word means...", "word, which is..."
const DEFINITION_PATTERNS = [
  /(\w+)[—–]\s*(that'?s|meaning|this means|in other words|also known as|or)/i,
  /(\w+)\s+(means|is when|refers to|is defined as|is called)/i,
  /(\w+),?\s+which (is|means|refers to)/i,
];

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
}

export function computeAcademicLanguage(
  teacherSegments: TranscriptSegment[]
): AcademicLanguageSummary {
  if (teacherSegments.length === 0) {
    return { tier2Words: [], tier2Count: 0, definitionRate: null };
  }

  const fullText = teacherSegments.map((s) => s.text).join(" ");
  const tokens = tokenize(fullText);

  // Count occurrences of each Tier 2 word
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (TIER2_WORDS.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    return { tier2Words: [], tier2Count: 0, definitionRate: null };
  }

  // Detect which words were defined in context
  const definedWords = new Set<string>();
  for (const pattern of DEFINITION_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags + "g");
    while ((match = re.exec(fullText)) !== null) {
      const word = match[1]?.toLowerCase();
      if (word && TIER2_WORDS.has(word)) definedWords.add(word);
    }
  }

  const tier2Words: Tier2WordUsage[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count, definedInContext: definedWords.has(word) }));

  const definedCount = tier2Words.filter((w) => w.definedInContext).length;
  const definitionRate =
    tier2Words.length > 0 ? Math.round((definedCount / tier2Words.length) * 1000) / 1000 : null;

  return { tier2Words, tier2Count: tier2Words.length, definitionRate };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run apps/server/tests/pipeline/vocabulary.test.ts
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/pipeline/vocabulary.ts apps/server/tests/pipeline/vocabulary.test.ts
git commit -m "feat(pipeline): academic language Tier 2 word detection"
```

---

## Task 4: Lesson Launch + Funneling/Focusing — upgrade `analyze.ts`

**Files:**
- Modify: `apps/server/src/pipeline/analyze.ts`
- Modify: `packages/shared/src/constants.ts` (add `lesson_launch` to `INSIGHT_TYPES`)

- [ ] **Step 1: Add `lesson_launch` to `INSIGHT_TYPES` in `packages/shared/src/constants.ts`**

Change:
```typescript
export const INSIGHT_TYPES = [
  "question_open", "question_closed", "question_focusing",
  "question_procedural", "question_rhetorical",
  "wait_time_1", "wait_time_2", "uptake",
  "long_student_talk", "short_student_response",
  "praise_specific", "praise_general", "correction",
  "teacher_instruct", "teacher_explain", "teacher_feedback", "teacher_manage",
] as const;
```
To:
```typescript
export const INSIGHT_TYPES = [
  "question_open", "question_closed", "question_focusing",
  "question_procedural", "question_rhetorical",
  "wait_time_1", "wait_time_2", "uptake",
  "long_student_talk", "short_student_response",
  "praise_specific", "praise_general", "correction",
  "teacher_instruct", "teacher_explain", "teacher_feedback", "teacher_manage",
  "lesson_launch",
] as const;
```

- [ ] **Step 2: Add two sections to the `SYSTEM_PROMPT` in `analyze.ts`**

In the `SYSTEM_PROMPT` string, add this before `==== OUTPUT ====`:

```
==== LESSON LAUNCH ====

Scan only the FIRST 5 MINUTES of teacher speech (startMs < 300000) for the following. Emit AT MOST ONE lesson_launch insight (even if multiple elements are found):
- metadata.learningIntention: { detected: boolean, timestampMs: number|null, quote: string|null }
  True if teacher explicitly states what students will learn. ("Today we're working on...", "Our goal today is...", "By the end you'll be able to...")
- metadata.successCriteria: { detected: boolean, timestampMs: number|null, quote: string|null }
  True if teacher tells students HOW they'll know they learned it. ("You'll know you've got it when...", "Success looks like...")
- metadata.relevanceHook: { detected: boolean, timestampMs: number|null, quote: string|null }
  True if teacher connects content to prior learning or real-world relevance. ("This builds on...", "You'll use this when...", "Last time we...")
If a lesson_launch element is not present, set detected: false and timestampMs/quote: null.
startMs/endMs for the insight: span of first 5 minutes (0–300000) or actual lesson duration if shorter.

==== QUESTION FOCUSING TYPE ====

For each question_open insight, add a field to metadata:
- metadata.focusingType: "focusing" | "funneling"
  - "focusing": genuinely invites student reasoning, has no predetermined answer the teacher is fishing for. ("What do you notice?", "What are you thinking?", "What would happen if...?", "How did you approach that?")
  - "funneling": leads student toward the teacher's predetermined answer, teacher already knows what they want to hear. ("So we'd multiply, right?", "What's the next step after we find the LCM?", "Isn't it true that...?")
  Default to "focusing" when uncertain.

```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes. The `lesson_launch` type is now valid in `InsightType`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/pipeline/analyze.ts packages/shared/src/constants.ts
git commit -m "feat(pipeline): add lesson_launch insight + funneling/focusing question classification"
```

---

## Task 5: Wire new signals into `report.ts`

**Files:**
- Modify: `apps/server/src/pipeline/report.ts`

The report LLM call already receives `insights` and `teacherSegments`. We extend `GenerateReportInput` to accept pre-computed `studentReasoning` and `academicLanguage`, and extract `lessonLaunch` and `questionQuality` from insights.

- [ ] **Step 1: Add new imports to `report.ts`**

```typescript
import type {
  // ...existing...
  LessonLaunchScore,
  QuestionQualityBreakdown,
  StudentReasoningResult,
  AcademicLanguageSummary,
} from "@coachline/shared";
```

- [ ] **Step 2: Extend `GenerateReportInput`**

Add to the interface:
```typescript
studentReasoning: StudentReasoningResult;
academicLanguage: AcademicLanguageSummary;
```

- [ ] **Step 3: Add two helper functions**

Add after `computeVocabGradeLevel`:

```typescript
function extractLessonLaunch(insights: RawInsight[]): LessonLaunchScore | null {
  const raw = insights.find((i) => i.type === "lesson_launch");
  if (!raw) return null;
  const m = raw.metadata as {
    learningIntention?: { detected: boolean; timestampMs: number | null; quote: string | null };
    successCriteria?: { detected: boolean; timestampMs: number | null; quote: string | null };
    relevanceHook?: { detected: boolean; timestampMs: number | null; quote: string | null };
  };
  const li = m.learningIntention ?? { detected: false, timestampMs: null, quote: null };
  const sc = m.successCriteria ?? { detected: false, timestampMs: null, quote: null };
  const rh = m.relevanceHook ?? { detected: false, timestampMs: null, quote: null };
  const score = [li.detected, sc.detected, rh.detected].filter(Boolean).length;
  return { score, learningIntention: li, successCriteria: sc, relevanceHook: rh };
}

function computeQuestionQuality(insights: RawInsight[]): QuestionQualityBreakdown {
  const openQuestions = insights.filter((i) => i.type === "question_open");
  let focusing = 0;
  let funneling = 0;
  for (const q of openQuestions) {
    const ft = (q.metadata as { focusingType?: string }).focusingType;
    if (ft === "funneling") funneling++;
    else focusing++; // default to focusing when absent or "focusing"
  }
  const total = focusing + funneling;
  return {
    focusing,
    funneling,
    focusingRatio: total > 0 ? Math.round((focusing / total) * 1000) / 1000 : null,
  };
}
```

- [ ] **Step 4: Update `generateReport` to destructure new inputs and populate `baseSummary`**

Add `studentReasoning` and `academicLanguage` to the destructure:
```typescript
const {
  insights, talkTime, totalDurationMs, activeGoal, teacherSegments,
  targetGrade, intent, participationDistribution, discoursePatterns,
  studentReasoning, academicLanguage,
} = input;
```

Add to `baseSummary` (after `discoursePatterns`):
```typescript
lessonLaunch: extractLessonLaunch(insights),
questionQuality: computeQuestionQuality(insights),
studentReasoning,
academicLanguage,
```

- [ ] **Step 5: Update the report LLM system prompt to reference new signals**

Append this paragraph to the `SYSTEM_PROMPT` string (before the final instruction line "Return JSON with exactly these keys"):

```
==== NEW SIGNALS ====

lessonLaunch: if present, its score (0–3) indicates how well the lesson was opened. Score 0 = no opening clarity established; treat this as a coaching opportunity in direct_instruction, inquiry, and workshop intents. For other intents it is secondary signal.

questionQuality: focusingRatio < 0.35 means most "open" questions were actually funneling — fishing for a predetermined answer rather than inviting student reasoning. For inquiry and discussion intents, this is a primary coaching signal.

studentReasoning: reasoningRatio < 0.20 means few student turns contained evidence/causal language. The topTriggeringMoveType tells you which of the teacher's moves actually elicited reasoning — reference this in the nextMove when relevant.

academicLanguage: definitionRate < 0.50 means the teacher introduced Tier 2/3 vocabulary without defining it in context. Relevant for direct_instruction and ELA/science/social_studies subjects.

These signals are available in the summary you receive. Reference them where they support the nextMove or reflection prompts. Do not invent values not present in the data.

```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/pipeline/report.ts
git commit -m "feat(pipeline): wire lesson launch, question quality, student reasoning, academic language into report"
```

---

## Task 6: Wire everything through `orchestrator.ts`

**Files:**
- Modify: `apps/server/src/pipeline/orchestrator.ts`

- [ ] **Step 1: Add imports**

```typescript
import { computeParticipationDistribution, computeDiscoursePatterns, computeStudentReasoning } from "./discourse";
import { computeAcademicLanguage } from "./vocabulary";
```

- [ ] **Step 2: Add the two new computation calls after the existing discourse calls**

After `const discoursePatterns = computeDiscoursePatterns(...)`, add:

```typescript
const studentReasoning = computeStudentReasoning(transcription.segments, rawInsights);
const academicLanguage = computeAcademicLanguage(teacherSegments);
```

(`teacherSegments` is already defined at this point in the function.)

- [ ] **Step 3: Pass new fields to `generateReport`**

Add to the `generateReport` call:
```typescript
studentReasoning,
academicLanguage,
```

- [ ] **Step 4: Update `computeGoalMetric` to handle 3 new practice areas**

In the `switch` statement, add before `default`:

```typescript
case "equity_of_voice": {
  // Lower Gini = more equitable. Store as-is; goal progress trends toward 0.
  return summary.participationDistribution?.giniCoefficient ?? null;
}
case "dialogue_quality": {
  // Lower IRE closure rate = better dialogue. Store as-is; trends toward 0.
  return summary.discoursePatterns?.ireClosureRate ?? null;
}
case "lesson_clarity": {
  // Higher score = better launch (0–3).
  const ll = summary.lessonLaunch;
  return ll !== null ? ll.score : null;
}
```

- [ ] **Step 5: Run typecheck + tests**

```bash
npm run typecheck && npx vitest run apps/server/tests/pipeline/
```
Expected: typecheck passes; all pipeline tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/pipeline/orchestrator.ts
git commit -m "feat(pipeline): orchestrate all 6 coaching signals + 3 new goal metrics"
```

---

## Task 7: Intent-cards utility

**Files:**
- Create: `apps/server/web/src/lib/intent-cards.ts`

- [ ] **Step 1: Create the file**

```typescript
export type CardKey =
  | "equity_of_voice"
  | "dialogue_flow"
  | "student_reasoning"
  | "lesson_launch"
  | "question_quality"
  | "academic_language";

export const ALL_CARDS: CardKey[] = [
  "equity_of_voice",
  "dialogue_flow",
  "student_reasoning",
  "lesson_launch",
  "question_quality",
  "academic_language",
];

// Returns the 3 focus cards for a given lesson intent.
// When intent is null (teacher didn't select one), all cards are equal weight.
const INTENT_FOCUS: Record<string, CardKey[]> = {
  discussion:          ["equity_of_voice", "dialogue_flow", "student_reasoning"],
  inquiry:             ["question_quality", "student_reasoning", "dialogue_flow"],
  direct_instruction:  ["lesson_launch", "academic_language", "question_quality"],
  workshop:            ["student_reasoning", "equity_of_voice", "academic_language"],
  collaborative:       ["equity_of_voice", "dialogue_flow", "student_reasoning"],
  review:              ["question_quality", "student_reasoning", "lesson_launch"],
  assessment:          ["question_quality", "equity_of_voice", "lesson_launch"],
};

export function getFocusCards(intent: string | null): CardKey[] {
  if (!intent) return [];
  return INTENT_FOCUS[intent] ?? [];
}

export function isFocusCard(card: CardKey, intent: string | null): boolean {
  return getFocusCards(intent).includes(card);
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/lib/intent-cards.ts
git commit -m "feat(web): intent-to-focus-card mapping utility"
```

---

## Task 8: Build the 6 metric card components

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/` (6 files)

Each card receives the full `ReportSummary` as a prop and renders one metric. They are pure display components with no data fetching.

- [ ] **Step 1: Create `EquityOfVoiceCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/EquityOfVoiceCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function EquityOfVoiceCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const p = summary.participationDistribution;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-purple-500 relative">
        <div className="absolute top-2 right-3 bg-purple-900/60 text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🗣 Equity of Voice</p>
        <div className="flex items-end gap-1.5 mb-3 h-9">
          {Array.from({ length: Math.min(p.uniqueStudentVoices, 7) }).map((_, i) => {
            const size = Math.max(8, 28 - i * 3);
            return (
              <div
                key={i}
                className="rounded-full bg-purple-700 flex-shrink-0 flex items-center justify-center"
                style={{ width: size, height: size, fontSize: 7, color: "#fff" }}
              />
            );
          })}
          {p.uniqueStudentVoices === 0 && (
            <span className="text-xs text-slate-500">No student voices detected</span>
          )}
        </div>
        <p className="text-sm font-semibold text-white">
          {p.uniqueStudentVoices} student{p.uniqueStudentVoices !== 1 ? "s" : ""} heard
        </p>
        {p.giniCoefficient !== null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Gini {p.giniCoefficient.toFixed(2)} ·{" "}
            {p.giniCoefficient > 0.6 ? "concentrated" : "distributed"}
          </p>
        )}
        {p.top3SpeakersPercent !== null && (
          <p className="mt-3 text-[10px] text-purple-300 bg-purple-900/40 rounded px-2 py-1.5 leading-snug">
            Top 3 speakers held {Math.round(p.top3SpeakersPercent * 100)}% of student talk.
            For discussion, aim for &lt;40%.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🗣 Equity of Voice</p>
      <p className="text-lg font-bold text-white">{p.uniqueStudentVoices}</p>
      <p className="text-[9px] text-slate-500">voices heard</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `DialogueFlowCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/DialogueFlowCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function DialogueFlowCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const d = summary.discoursePatterns;
  const pingPct = Math.round(d.pingPongIndex * 100);
  const ireClosePct = d.ireClosureRate !== null ? Math.round(d.ireClosureRate * 100) : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-sky-500 relative">
        <div className="absolute top-2 right-3 bg-sky-900/60 text-sky-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🏓 Dialogue Flow</p>
        <div className="flex gap-1 flex-wrap mb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-3.5 h-2 rounded-sm bg-blue-700" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-3.5 h-2 rounded-sm bg-emerald-800" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-amber-400 font-bold text-sm">{pingPct}%</p>
            <p className="text-[8px] text-slate-500">🏓 ping-pong</p>
          </div>
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-emerald-400 font-bold text-sm">{100 - pingPct}%</p>
            <p className="text-[8px] text-slate-500">🏐 volleyball</p>
          </div>
          <div className="bg-[#0f172a] rounded p-2 text-center">
            <p className="text-pink-400 font-bold text-sm">{ireClosePct ?? "—"}%</p>
            <p className="text-[8px] text-slate-500">IRE close</p>
          </div>
        </div>
        <p className="text-[10px] text-sky-300 bg-sky-900/30 rounded px-2 py-1.5 leading-snug">
          For discussion, aim for 20%+ volleyball. Longest student chain: {d.maxStudentChainLength}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🏓 Dialogue Flow</p>
      <p className="text-lg font-bold text-amber-400">{pingPct}%</p>
      <p className="text-[9px] text-slate-500">ping-pong</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `StudentReasoningCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/StudentReasoningCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function StudentReasoningCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const r = summary.studentReasoning;
  const pct = r.reasoningRatio !== null ? Math.round(r.reasoningRatio * 100) : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-emerald-500 relative">
        <div className="absolute top-2 right-3 bg-emerald-900/60 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🧠 Student Reasoning</p>
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="text-slate-400">Reasoning turns</span>
          <span className="text-emerald-400 font-bold">{pct ?? "—"}%</span>
        </div>
        <div className="h-1.5 bg-[#0f172a] rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full"
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
        <p className="text-[9px] text-slate-500 mb-2">Target: 50%+ for discussion/inquiry</p>
        {r.topTriggeringMoveType && (
          <p className="text-[10px] text-emerald-300 bg-emerald-900/30 rounded px-2 py-1.5 leading-snug">
            Most reasoning followed your <strong>{r.topTriggeringMoveType}</strong> moves. More of
            those → more because/since/therefore.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🧠 Student Reasoning</p>
      <p className="text-lg font-bold text-emerald-400">{pct ?? "—"}%</p>
      <p className="text-[9px] text-slate-500">reasoning turns</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `LessonLaunchCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/LessonLaunchCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function LessonLaunchCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const ll = summary.lessonLaunch;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-yellow-500 relative">
        <div className="absolute top-2 right-3 bg-yellow-900/60 text-yellow-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">🚀 Lesson Launch</p>
        {!ll ? (
          <p className="text-xs text-slate-500">No teacher speech detected in first 5 minutes.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-3">
              {[
                { key: "learningIntention", label: "Learning intention" },
                { key: "successCriteria", label: "Success criteria" },
                { key: "relevanceHook", label: "Relevance hook" },
              ].map(({ key, label }) => {
                const check = ll[key as keyof typeof ll] as { detected: boolean };
                return (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className={check.detected ? "text-emerald-400" : "text-red-400"}>
                      {check.detected ? "✓" : "✗"}
                    </span>
                    <span className={check.detected ? "text-white" : "text-slate-500"}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold text-sm">{ll.score} / 3</span>
              <span className="text-[9px] text-slate-500">Hattie d=0.84–0.88</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">🚀 Lesson Launch</p>
      <p className="text-lg font-bold text-yellow-400">{ll?.score ?? "—"}<span className="text-[10px] text-slate-500">/3</span></p>
      <p className="text-[9px] text-slate-500">clarity score</p>
    </div>
  );
}
```

- [ ] **Step 5: Create `QuestionQualityCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/QuestionQualityCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function QuestionQualityCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const q = summary.questionQuality;
  const focusingPct = q.focusingRatio !== null ? Math.round(q.focusingRatio * 100) : null;
  const funnelingPct = focusingPct !== null ? 100 - focusingPct : null;

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-orange-500 relative">
        <div className="absolute top-2 right-3 bg-orange-900/60 text-orange-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">❓ Question Quality</p>
        {q.focusingRatio === null ? (
          <p className="text-xs text-slate-500">No open questions detected.</p>
        ) : (
          <>
            <div className="h-2 rounded-full overflow-hidden flex mb-2">
              <div className="bg-orange-500" style={{ width: `${focusingPct}%` }} />
              <div className="bg-red-700" style={{ width: `${funnelingPct}%` }} />
            </div>
            <div className="flex gap-4 text-[10px] mb-3">
              <span className="text-orange-400">{focusingPct}% focusing</span>
              <span className="text-red-400">{funnelingPct}% funneling</span>
            </div>
            <p className="text-[10px] text-orange-300 bg-orange-900/30 rounded px-2 py-1.5 leading-snug">
              Benchmark: 60%+ focusing. RCT evidence: AI feedback → 20% more focusing in 4 weeks.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">❓ Question Quality</p>
      <p className="text-lg font-bold text-orange-400">{focusingPct ?? "—"}%</p>
      <p className="text-[9px] text-slate-500">focusing</p>
    </div>
  );
}
```

- [ ] **Step 6: Create `AcademicLanguageCard.tsx`**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/cards/AcademicLanguageCard.tsx
import type { ReportSummary } from "@coachline/shared";

export function AcademicLanguageCard({
  summary,
  focus,
}: {
  summary: ReportSummary;
  focus: boolean;
}) {
  const a = summary.academicLanguage;
  const defPct =
    a.definitionRate !== null ? Math.round(a.definitionRate * 100) : null;
  const topWords = a.tier2Words.slice(0, 5);

  if (focus) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-4 border-t-2 border-fuchsia-500 relative">
        <div className="absolute top-2 right-3 bg-fuchsia-900/60 text-fuchsia-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
          ★ FOCUS
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mb-3">📚 Academic Language</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topWords.map((w) => (
            <span
              key={w.word}
              className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                w.definedInContext
                  ? "bg-fuchsia-900/60 text-fuchsia-200"
                  : "bg-[#1e1b4b] text-indigo-300"
              }`}
            >
              {w.word} ×{w.count}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mb-1">
          {a.tier2Count} Tier 2 words · {defPct ?? "—"}% defined in context
        </p>
        {a.definitionRate !== null && a.definitionRate < 0.5 && (
          <p className="text-[10px] text-fuchsia-300 bg-fuchsia-900/30 rounded px-2 py-1.5 leading-snug">
            Define vocabulary in context as you use it — students need 12+ exposures to acquire
            a word. (Beck et al. 2002)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-center opacity-65">
      <p className="text-[9px] text-slate-500 mb-1">📚 Academic Language</p>
      <p className="text-lg font-bold text-fuchsia-400">{a.tier2Count}</p>
      <p className="text-[9px] text-slate-500">Tier 2 words</p>
    </div>
  );
}
```

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/lessons/'[id]'/components/cards/
git commit -m "feat(web): 6 research-backed metric card components"
```

---

## Task 9: Build Zone 1 — Coach hero

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone1.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone1.tsx
import type { LessonReport } from "@coachline/shared";

const INTENT_LABELS: Record<string, string> = {
  direct_instruction: "Direct Instruction", discussion: "Discussion",
  inquiry: "Inquiry", workshop: "Workshop", review: "Review",
  collaborative: "Collaborative", assessment: "Assessment",
};

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math", ela: "ELA", science: "Science",
  social_studies: "Social Studies", other: "Other",
};

export function ReportZone1({
  report,
  intent,
}: {
  report: LessonReport;
  intent: string | null;
}) {
  const { summary, highlightedMoments, reflectionPrompts } = report;
  const totalMinutes = Math.floor((summary?.totalDurationMs ?? 0) / 60000);

  return (
    <div className="space-y-5">
      {/* Metadata bar */}
      <div className="flex flex-wrap gap-2">
        {intent && (
          <span className="px-3 py-1 rounded-full bg-blue-950 text-blue-300 text-xs font-semibold border border-blue-800">
            📋 {INTENT_LABELS[intent] ?? intent}
          </span>
        )}
        {summary?.subject && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {SUBJECT_LABELS[summary.subject] ?? summary.subject}
          </span>
        )}
        {summary?.topic && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {summary.topic}
          </span>
        )}
        {totalMinutes > 0 && (
          <span className="px-3 py-1 rounded-full bg-[#1e293b] text-slate-400 text-xs">
            {totalMinutes} min
          </span>
        )}
      </div>

      {/* One Move hero */}
      {summary?.nextMove && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0c2a4a] to-[#1e293b] border border-blue-800 rounded-2xl p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mb-2">
            ⚡ One Move for Your Next Lesson
          </p>
          <p className="text-xl font-bold text-white leading-snug mb-3">
            {summary.nextMove.title}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            {summary.nextMove.description}
          </p>
          <p className="text-xs text-slate-500 italic mb-4">
            {summary.nextMove.whyItWorks}
          </p>
          {summary.nextMove.rehearsalScript && (
            <div className="border-l-2 border-blue-500 pl-4 bg-white/[0.03] rounded-r-lg py-2 pr-3">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                Try saying
              </p>
              <p className="text-sm text-slate-200 italic">
                &ldquo;{summary.nextMove.rehearsalScript}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Highlighted Moments */}
      {highlightedMoments?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            ✨ Highlighted Moments
          </p>
          <div className="space-y-2">
            {highlightedMoments.map((m, i) => (
              <div key={i} className="flex gap-3 bg-[#1e293b] rounded-xl p-3 items-start">
                <span className="flex-shrink-0 bg-emerald-900 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
                  {Math.floor(m.startMs / 1000)}s →
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection Prompts */}
      {reflectionPrompts?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            🪞 Reflection Prompts
          </p>
          <div className="space-y-2">
            {reflectionPrompts.map((prompt, i) => (
              <div key={i} className="bg-[#1e293b] rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
                <span className="text-violet-400 font-bold mr-2">{i + 1}.</span>
                {prompt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/lessons/'[id]'/components/ReportZone1.tsx
git commit -m "feat(web): Zone 1 Coach hero component"
```

---

## Task 10: Build Zone 2 — The Room

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone2.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone2.tsx
import type { ReportSummary } from "@coachline/shared";
import { ALL_CARDS, isFocusCard, type CardKey } from "@/lib/intent-cards";
import { EquityOfVoiceCard } from "./cards/EquityOfVoiceCard";
import { DialogueFlowCard } from "./cards/DialogueFlowCard";
import { StudentReasoningCard } from "./cards/StudentReasoningCard";
import { LessonLaunchCard } from "./cards/LessonLaunchCard";
import { QuestionQualityCard } from "./cards/QuestionQualityCard";
import { AcademicLanguageCard } from "./cards/AcademicLanguageCard";

const INTENT_LABELS: Record<string, string> = {
  direct_instruction: "Direct Instruction", discussion: "Discussion",
  inquiry: "Inquiry", workshop: "Workshop", review: "Review",
  collaborative: "Collaborative", assessment: "Assessment",
};

function CardComponent({ card, summary, focus }: { card: CardKey; summary: ReportSummary; focus: boolean }) {
  switch (card) {
    case "equity_of_voice": return <EquityOfVoiceCard summary={summary} focus={focus} />;
    case "dialogue_flow": return <DialogueFlowCard summary={summary} focus={focus} />;
    case "student_reasoning": return <StudentReasoningCard summary={summary} focus={focus} />;
    case "lesson_launch": return <LessonLaunchCard summary={summary} focus={focus} />;
    case "question_quality": return <QuestionQualityCard summary={summary} focus={focus} />;
    case "academic_language": return <AcademicLanguageCard summary={summary} focus={focus} />;
  }
}

export function ReportZone2({
  summary,
  intent,
}: {
  summary: ReportSummary;
  intent: string | null;
}) {
  const focusCards = ALL_CARDS.filter((c) => isFocusCard(c, intent));
  const secondaryCards = ALL_CARDS.filter((c) => !isFocusCard(c, intent));
  const hasFocus = focusCards.length > 0;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          The Room
        </p>
        <div className="flex-1 h-px bg-[#1e293b]" />
        {intent && hasFocus && (
          <span className="px-3 py-1 rounded-full bg-blue-950 text-blue-300 text-[10px] font-semibold border border-blue-800">
            📋 {INTENT_LABELS[intent] ?? intent} lens
          </span>
        )}
      </div>

      {/* Focus cards — full size, 3-column */}
      {hasFocus && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {focusCards.map((card) => (
            <CardComponent key={card} card={card} summary={summary} focus={true} />
          ))}
        </div>
      )}

      {/* Secondary cards — condensed, 3-column */}
      <div className={`grid grid-cols-3 gap-2 ${!hasFocus ? "sm:grid-cols-3" : ""}`}>
        {(hasFocus ? secondaryCards : ALL_CARDS).map((card) => (
          <CardComponent key={card} card={card} summary={summary} focus={false} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/lessons/'[id]'/components/ReportZone2.tsx
git commit -m "feat(web): Zone 2 The Room with intent-surfaced card promotion"
```

---

## Task 11: Build Zone 3 — Full Data

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone3.tsx`

Zone 3 wraps the existing stat cards (talk time, DOK, etc.) in a disclosure/accordion and appends full-detail versions of all 6 new cards.

- [ ] **Step 1: Create `ReportZone3.tsx`**

Extract the utility sub-components that were inline in `page.tsx` into this file so they can be reused, and wrap them in a `<details>` disclosure:

```tsx
// apps/server/web/src/app/(dashboard)/lessons/[id]/components/ReportZone3.tsx
"use client";
import { useState } from "react";
import type { LessonReport, Transcript, TranscriptSegment } from "@coachline/shared";
import { EquityOfVoiceCard } from "./cards/EquityOfVoiceCard";
import { DialogueFlowCard } from "./cards/DialogueFlowCard";
import { StudentReasoningCard } from "./cards/StudentReasoningCard";
import { LessonLaunchCard } from "./cards/LessonLaunchCard";
import { QuestionQualityCard } from "./cards/QuestionQualityCard";
import { AcademicLanguageCard } from "./cards/AcademicLanguageCard";

function TalkTimeBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#111] rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function DistributionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-medium text-white tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SegmentBubble({ segment, isActive, onPlay }: { segment: TranscriptSegment; isActive: boolean; onPlay: () => void }) {
  const isTeacher = segment.speaker === "teacher";
  return (
    <div className={`flex gap-3 ${isTeacher ? "" : "flex-row-reverse"}`}>
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isTeacher ? "bg-violet-600" : "bg-indigo-600"} text-white`}>
        {isTeacher ? "T" : "S"}
      </div>
      <div
        onClick={onPlay}
        className={`max-w-[75%] rounded-xl px-3 py-2 border cursor-pointer transition-all ${isTeacher ? "bg-violet-600/10 border-violet-500/20 hover:border-violet-500/40" : "bg-[#1a1a1a] border-white/5 hover:border-white/15"} ${isActive ? "ring-1 ring-violet-500" : ""}`}
      >
        <p className="text-sm text-white leading-relaxed">{segment.text}</p>
        <p className="text-xs text-gray-600 mt-1">{Math.floor(segment.startMs / 1000)}s — {Math.floor(segment.endMs / 1000)}s</p>
      </div>
    </div>
  );
}

function gradeLabel(grade: number | null) {
  if (grade === null) return "—";
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

export function ReportZone3({
  report,
  transcript,
  activeSegment,
  onSegmentPlay,
}: {
  report: LessonReport;
  transcript: Transcript | null;
  activeSegment: number | null;
  onSegmentPlay: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = report.summary;
  const tt = s?.talkTime;
  const q = s?.questions;
  const wt = s?.waitTime;

  return (
    <div className="border border-dashed border-[#334155] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-slate-400">Full Analysis</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Talk time · Questions · Wait time · Uptake · Praise · Teacher moves · Vocab · 6 expanded cards
          </p>
        </div>
        <span className="text-slate-500 text-lg transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          ↓
        </span>
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-5 border-t border-[#1e293b]">
          {/* Talk Time */}
          {tt && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Talk Time</h3>
              <div className="space-y-3">
                <TalkTimeBar label="Teacher" percent={tt.teacherPercent} color="bg-violet-500" />
                <TalkTimeBar label="Student" percent={tt.studentPercent} color="bg-indigo-400" />
                <TalkTimeBar label="Group" percent={tt.groupPercent} color="bg-blue-400" />
                <TalkTimeBar label="Silence" percent={tt.silencePercent} color="bg-gray-600" />
              </div>
            </div>
          )}

          {/* Key Metrics */}
          {q && wt && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge label="Total Questions" value={q.total} />
                <StatBadge label="Open-ended" value={q.openEnded} />
                <StatBadge label="Wait Time 1 avg" value={`${Math.round(wt.waitTime1AvgMs / 1000)}s`} />
                <StatBadge label="Uptake moments" value={s?.uptakeCount ?? 0} />
                <StatBadge label="Long student talk" value={s?.longStudentTalkCount ?? 0} />
                <StatBadge label="Closed questions" value={q.closed} />
                <StatBadge label="Wait Time 2 avg" value={`${Math.round(wt.waitTime2AvgMs / 1000)}s`} />
                <StatBadge label="Focusing questions" value={q.focusing} />
              </div>
            </div>
          )}

          {/* DOK */}
          {q?.dok && (() => {
            const d = q.dok;
            const max = Math.max(d.level1, d.level2, d.level3, d.level4, d.unclassified, 1);
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Question Depth</h3>
                <p className="text-xs text-gray-500 mb-4">Webb's Depth of Knowledge</p>
                <div className="space-y-3">
                  <DistributionBar label="1 · Recall" value={d.level1} max={max} color="bg-violet-400/70" />
                  <DistributionBar label="2 · Skill/Concept" value={d.level2} max={max} color="bg-violet-500" />
                  <DistributionBar label="3 · Strategic" value={d.level3} max={max} color="bg-indigo-500" />
                  <DistributionBar label="4 · Extended" value={d.level4} max={max} color="bg-blue-500" />
                  {d.unclassified > 0 && <DistributionBar label="Unclassified" value={d.unclassified} max={max} color="bg-gray-600" />}
                </div>
              </div>
            );
          })()}

          {/* Praise */}
          {s?.praise && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Praise &amp; Correction</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBadge label="Specific praise" value={s.praise.specific} />
                <StatBadge label="General praise" value={s.praise.general} />
                <StatBadge label="Corrections" value={s.praise.correction} />
                <StatBadge label="Praise:Correction" value={s.praise.praiseToCorrectionRatio?.toFixed(1) ?? "—"} />
              </div>
            </div>
          )}

          {/* Teacher Moves */}
          {s?.teacherMoves && (() => {
            const m = s.teacherMoves;
            const max = Math.max(m.instruct, m.explain, m.question, m.feedback, m.manage, 1);
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Teacher Moves</h3>
                <div className="space-y-3">
                  <DistributionBar label="Explain" value={m.explain} max={max} color="bg-violet-500" />
                  <DistributionBar label="Question" value={m.question} max={max} color="bg-indigo-500" />
                  <DistributionBar label="Instruct" value={m.instruct} max={max} color="bg-blue-500" />
                  <DistributionBar label="Feedback" value={m.feedback} max={max} color="bg-cyan-500" />
                  <DistributionBar label="Manage" value={m.manage} max={max} color="bg-gray-500" />
                </div>
              </div>
            );
          })()}

          {/* Vocabulary */}
          {s?.vocabGradeLevel && (() => {
            const v = s.vocabGradeLevel;
            if (v.teacherFleschKincaid === null) return null;
            const delta = v.deltaVsTarget;
            const deltaColor = delta === null ? "text-gray-400" : Math.abs(delta) <= 1 ? "text-green-400" : delta > 1 ? "text-amber-400" : "text-rose-400";
            return (
              <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Vocabulary Grade Level</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatBadge label="Teacher FK grade" value={v.teacherFleschKincaid.toFixed(1)} />
                  <StatBadge label="Target grade" value={gradeLabel(v.targetGrade)} />
                  <div className="bg-[#111] rounded-lg p-3 text-center">
                    <p className={`text-lg font-bold tabular-nums ${deltaColor}`}>
                      {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{delta === null ? "Set target grade" : "vs target"}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 6 new cards — full detail */}
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Metrics — Full Detail</h3>
          <div className="space-y-3">
            {s && (
              <>
                <EquityOfVoiceCard summary={s} focus={true} />
                <DialogueFlowCard summary={s} focus={true} />
                <LessonLaunchCard summary={s} focus={true} />
                <QuestionQualityCard summary={s} focus={true} />
                <StudentReasoningCard summary={s} focus={true} />
                <AcademicLanguageCard summary={s} focus={true} />
              </>
            )}
          </div>

          {/* Transcript */}
          {transcript && transcript.segments?.length > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Transcript</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {transcript.segments.map((seg, i) => (
                  <SegmentBubble
                    key={i}
                    segment={seg}
                    isActive={activeSegment === i}
                    onPlay={() => onSegmentPlay(i)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/lessons/'[id]'/components/ReportZone3.tsx
git commit -m "feat(web): Zone 3 Full Data disclosure component"
```

---

## Task 12: Restructure lesson report page

**Files:**
- Modify: `apps/server/web/src/app/(dashboard)/lessons/[id]/page.tsx`

Replace the entire flat page with the 3-zone layout. The page becomes a thin data-fetching shell; all rendering is delegated to the Zone components.

- [ ] **Step 1: Replace `page.tsx` content**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LessonReport, LessonRecording, Transcript } from "@coachline/shared";
import { ReportZone1 } from "./components/ReportZone1";
import { ReportZone2 } from "./components/ReportZone2";
import { ReportZone3 } from "./components/ReportZone3";

export default function LessonReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<LessonReport | null>(null);
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rep, trans] = await Promise.all([
          api.get<LessonReport>(`/reports/${params.id}`),
          api.get<Transcript>(`/reports/${params.id}/transcript`).catch(() => null),
        ]);
        setReport(rep);
        setTranscript(trans);
        // Fetch recording for intent
        const recId = rep.recordingId;
        if (recId) {
          api.get<LessonRecording>(`/recordings/${recId}`).then(setRecording).catch(() => null);
        }
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error || "Report not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-400 hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  const intent = recording?.intent ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {report.status !== "completed" && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-400 text-sm">
          This report is still {report.status}. Full analytics will be available when processing is complete.
        </div>
      )}

      {report.status === "completed" && report.summary && (
        <>
          {/* Zone 1 — The Coach */}
          <ReportZone1 report={report} intent={intent} />

          {/* Zone 2 — The Room */}
          <ReportZone2 summary={report.summary} intent={intent} />

          {/* Zone 3 — Full Data */}
          <ReportZone3
            report={report}
            transcript={transcript}
            activeSegment={activeSegment}
            onSegmentPlay={(i) => {
              setActiveSegment(i);
              if (audioRef.current && transcript?.segments[i]) {
                audioRef.current.currentTime = transcript.segments[i].startMs / 1000;
                audioRef.current.play();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check that the recordings route returns `intent`**

Run a quick grep to confirm the recordings GET endpoint includes `intent` in its response:

```bash
grep -n "intent" /Users/kyle/Desktop/projects/coachline/apps/server/src/routes/recordings.ts | head -10
```

If `intent` is not included in the route's SELECT clause, add it. The field already exists on `LessonRecording` in the Prisma schema.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/lessons/'[id]'/
git commit -m "feat(web): restructure lesson report into 3-zone layout"
```

---

## Task 13: Update Goals page — 3 new practice areas

**Files:**
- Modify: `apps/server/web/src/app/(dashboard)/goals/page.tsx`

- [ ] **Step 1: Add the 3 new areas to `AREA_LABELS`**

Add to the `AREA_LABELS` object:
```typescript
equity_of_voice: "Equity of Voice",
dialogue_quality: "Dialogue Quality",
lesson_clarity: "Lesson Clarity",
```

- [ ] **Step 2: Add to `AREA_TARGET_HINTS`**

Add:
```typescript
equity_of_voice: "e.g. 0.5 (Gini coefficient; lower = more equal participation)",
dialogue_quality: "e.g. 0.4 (IRE closure rate; lower = more uptake instead of closures)",
lesson_clarity: "e.g. 3 (Lesson Launch score 0–3; higher = clearer opening)",
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes. The `PRACTICE_AREAS` constant (already updated in Task 1) drives the select options automatically.

- [ ] **Step 4: Commit**

```bash
git add apps/server/web/src/app/'(dashboard)'/goals/page.tsx
git commit -m "feat(web): add equity_of_voice, dialogue_quality, lesson_clarity to goals form"
```

---

## Task 14: Final integration test + security scan

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```
Expected: all pipeline tests pass. The auth route test will still show JWT_SECRET warning — that's pre-existing and acceptable.

- [ ] **Step 2: Run typecheck across entire monorepo**

```bash
npx prisma generate && npm run typecheck
```
Expected: all packages pass.

- [ ] **Step 3: Confirm `.gitignore` covers brainstorm artifacts**

```bash
grep -n "superpowers" /Users/kyle/Desktop/projects/coachline/.gitignore || echo "add .superpowers/ to .gitignore"
```

If not present, add `.superpowers/` to `.gitignore`:

```bash
echo ".superpowers/" >> /Users/kyle/Desktop/projects/coachline/.gitignore
git add .gitignore && git commit -m "chore: ignore brainstorm session artifacts"
```

- [ ] **Step 4: Run security scan on changed files**

```bash
semgrep scan --config auto --error \
  apps/server/src/pipeline/discourse.ts \
  apps/server/src/pipeline/vocabulary.ts \
  apps/server/src/pipeline/analyze.ts \
  apps/server/src/pipeline/report.ts \
  apps/server/src/pipeline/orchestrator.ts
```
Expected: no HIGH or CRITICAL findings. Fix any that appear before proceeding.

- [ ] **Step 5: Final commit**

```bash
git add -A && git status  # verify no secrets or unintended files staged
git commit -m "chore: final integration pass — evidence-backed lesson report"
```
