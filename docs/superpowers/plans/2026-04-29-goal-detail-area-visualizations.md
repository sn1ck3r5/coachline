# Goal-Detail Area-Specific Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic goal-detail line chart with area-specific visualizations for `dok_mix`, `praise_ratio`, `vocab_match`, and add research-backed reference lines/bands to the existing line chart for the other 8 practice areas.

**Architecture:** Read-side only. `GET /api/goals/:id/progress` joins `LessonReport.summary` and projects a discriminated `payload` per goal's `practiceArea`. The web page resolves a chart component via a dispatcher table keyed on `practiceArea`. No schema migration. No pipeline changes (verified during planning that the pipeline already stores the correct scalar in `GoalProgress.value` for every area — see Task 0).

**Tech Stack:** TypeScript, Fastify 4, Prisma 6, Recharts 3.8, React 19, Vitest 3, Tailwind. Recharts and Vitest are already installed.

**Spec:** [`docs/superpowers/specs/2026-04-29-goal-detail-area-visualizations-design.md`](../specs/2026-04-29-goal-detail-area-visualizations-design.md)

---

## Task 0: Confirm pipeline scalar semantics (verification only)

**Why:** Spec §10 risk #3 was "pipeline-stored `value` for vocab_match / praise_ratio may not be the scalar we want to plot." Verified during planning by reading `apps/server/src/pipeline/orchestrator.ts:135-175` (`computeGoalMetric`):

| Area | Stored `value` | Chart use |
|---|---|---|
| `dok_mix` | `(L3+L4)/total * 100` (% at high DOK) | Bespoke chart ignores `value`, reads `payload`; line-chart fallback OK |
| `praise_ratio` | `summary.praise.praiseToCorrectionRatio` (already a ratio) | Bespoke chart's secondary axis line plots the ratio directly |
| `vocab_match` | `summary.vocabGradeLevel.deltaVsTarget` (signed delta) | Bespoke chart's bar plots the delta directly |

No pipeline change required. Risk closed.

**Files:** _none_

- [ ] **Step 1: Verify the finding still holds**

Run: `grep -A 2 "case \"praise_ratio\"\|case \"vocab_match\"\|case \"dok_mix\"" apps/server/src/pipeline/orchestrator.ts`
Expected: confirms `praiseToCorrectionRatio`, `deltaVsTarget`, and `(L3+L4)/total*100` are what gets stored.

- [ ] **Step 2: Note this in handoff if it diverges**

If `grep` output differs from the table above, STOP and report to the user. The spec assumes these scalars and the chart components rely on them.

---

## Task 1: Extend shared GoalProgress type with payload union

**Files:**
- Modify: `packages/shared/src/types/goal.ts`
- Modify: `packages/shared/src/index.ts`
- Test: _none_ (pure type change)

- [ ] **Step 1: Add the discriminated payload type to `goal.ts`**

Replace the contents of `packages/shared/src/types/goal.ts` with:

```ts
import type { PracticeArea, GoalStatus } from "../constants";

export interface Goal {
  id: string;
  userId: string;
  practiceArea: PracticeArea;
  targetMetric: string;
  customLabel: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export type GoalProgressPayload =
  | {
      kind: "dok_mix";
      level1: number;
      level2: number;
      level3: number;
      level4: number;
      unclassified: number;
    }
  | {
      kind: "praise_ratio";
      specific: number;
      general: number;
      correction: number;
      specificToCorrection: number | null;
    }
  | {
      kind: "vocab_match";
      teacherFleschKincaid: number | null;
      targetGrade: number | null;
      deltaVsTarget: number | null;
    };

export interface GoalProgress {
  id: string;
  goalId: string;
  reportId: string;
  value: number;
  createdAt: string;
  payload: GoalProgressPayload | null;
}
```

- [ ] **Step 2: Re-export the new type**

Open `packages/shared/src/index.ts` and find the line `export type { Goal, GoalProgress } from "./types/goal";`. Change it to:

```ts
export type { Goal, GoalProgress, GoalProgressPayload } from "./types/goal";
```

- [ ] **Step 3: Run typecheck across the monorepo**

Run: `npm run typecheck`
Expected: PASS — server and web compile against the new type. There may be type errors in the goals route handler and/or the goal-detail page since they don't yet supply `payload`; those are addressed in Tasks 3 and 10. If errors appear *only* in those two files, that is fine and expected; do not fix them yet. If errors appear elsewhere, stop and investigate.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/goal.ts packages/shared/src/index.ts
git commit -m "feat(shared): add GoalProgressPayload discriminated union"
```

---

## Task 2: buildPayload projection function + unit tests

**Files:**
- Create: `apps/server/src/routes/goal-progress-payload.ts`
- Create: `apps/server/tests/routes/goal-progress-payload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/routes/goal-progress-payload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPayload } from "../../src/routes/goal-progress-payload";
import type { ReportSummary } from "@coachline/shared";

function baseSummary(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    talkTime: { teacherPercent: 0, studentPercent: 0, groupPercent: 0, silencePercent: 0, mediaPercent: 0 },
    questions: {
      total: 0, openEnded: 0, closed: 0, focusing: 0, procedural: 0, rhetorical: 0,
      dok: { level1: 1, level2: 2, level3: 3, level4: 4, unclassified: 0 },
    },
    waitTime: { waitTime1Count: 0, waitTime1AvgMs: 0, waitTime2Count: 0, waitTime2AvgMs: 0, bestMoments: [] },
    uptakeCount: 0,
    longStudentTalkCount: 0,
    studentQuestionCount: 0,
    totalDurationMs: 0,
    praise: { specific: 8, general: 1, correction: 2, specificVsGeneralRatio: null, praiseToCorrectionRatio: 4 },
    teacherMoves: { instruct: 0, explain: 0, question: 0, feedback: 0, manage: 0 },
    subject: null,
    topic: null,
    vocabGradeLevel: { teacherFleschKincaid: 7.2, targetGrade: 6, deltaVsTarget: 1.2 },
    lessonLaunch: null,
    questionQuality: { focusing: 0, funneling: 0, focusingRatio: null },
    studentReasoning: { reasoningTurnCount: 0, totalStudentTurnCount: 0, reasoningRatio: null, topTriggeringMoveType: null },
    academicLanguage: { tier2Words: [], tier2Count: 0, definitionRate: null },
    participationDistribution: { uniqueStudentVoices: 0, giniCoefficient: null, top3SpeakersPercent: null },
    discoursePatterns: { pingPongIndex: 0, volleyballIndex: 0, maxStudentChainLength: 0, ireClosureRate: null },
    nextMove: null,
    ...overrides,
  };
}

describe("buildPayload", () => {
  it("returns null for areas without a bespoke payload", () => {
    expect(buildPayload("wait_time", baseSummary())).toBeNull();
    expect(buildPayload("open_questions", baseSummary())).toBeNull();
    expect(buildPayload("custom", baseSummary())).toBeNull();
    expect(buildPayload("equity_of_voice", baseSummary())).toBeNull();
  });

  it("projects dok_mix from summary.questions.dok", () => {
    const result = buildPayload("dok_mix", baseSummary());
    expect(result).toEqual({
      kind: "dok_mix", level1: 1, level2: 2, level3: 3, level4: 4, unclassified: 0,
    });
  });

  it("returns null for dok_mix when summary.questions.dok is missing", () => {
    const summary = baseSummary();
    // simulate legacy report missing dok slice
    (summary.questions as unknown as Record<string, unknown>).dok = undefined;
    expect(buildPayload("dok_mix", summary)).toBeNull();
  });

  it("projects praise_ratio with computed specific/correction ratio", () => {
    const result = buildPayload("praise_ratio", baseSummary());
    expect(result).toEqual({
      kind: "praise_ratio", specific: 8, general: 1, correction: 2, specificToCorrection: 4,
    });
  });

  it("returns null specificToCorrection when correction is zero", () => {
    const summary = baseSummary({
      praise: { specific: 5, general: 0, correction: 0, specificVsGeneralRatio: null, praiseToCorrectionRatio: null },
    });
    const result = buildPayload("praise_ratio", summary);
    expect(result).toEqual({
      kind: "praise_ratio", specific: 5, general: 0, correction: 0, specificToCorrection: null,
    });
  });

  it("projects vocab_match including null fields", () => {
    const result = buildPayload("vocab_match", baseSummary());
    expect(result).toEqual({
      kind: "vocab_match", teacherFleschKincaid: 7.2, targetGrade: 6, deltaVsTarget: 1.2,
    });
  });

  it("returns null vocab_match when summary.vocabGradeLevel is missing", () => {
    const summary = baseSummary();
    (summary as unknown as Record<string, unknown>).vocabGradeLevel = undefined;
    expect(buildPayload("vocab_match", summary)).toBeNull();
  });

  it("does not throw on null/undefined summary", () => {
    expect(buildPayload("dok_mix", null as unknown as ReportSummary)).toBeNull();
    expect(buildPayload("praise_ratio", undefined as unknown as ReportSummary)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/tests/routes/goal-progress-payload.test.ts`
Expected: FAIL — `Cannot find module '../../src/routes/goal-progress-payload'`.

- [ ] **Step 3: Implement `buildPayload`**

Create `apps/server/src/routes/goal-progress-payload.ts`:

```ts
import type { GoalProgressPayload, PracticeArea, ReportSummary } from "@coachline/shared";

export function buildPayload(
  area: PracticeArea,
  summary: ReportSummary | null | undefined
): GoalProgressPayload | null {
  if (!summary) return null;

  switch (area) {
    case "dok_mix": {
      const dok = summary.questions?.dok;
      if (!dok) return null;
      return {
        kind: "dok_mix",
        level1: dok.level1,
        level2: dok.level2,
        level3: dok.level3,
        level4: dok.level4,
        unclassified: dok.unclassified,
      };
    }
    case "praise_ratio": {
      const praise = summary.praise;
      if (!praise) return null;
      const specificToCorrection =
        praise.correction === 0 ? null : praise.specific / praise.correction;
      return {
        kind: "praise_ratio",
        specific: praise.specific,
        general: praise.general,
        correction: praise.correction,
        specificToCorrection,
      };
    }
    case "vocab_match": {
      const vocab = summary.vocabGradeLevel;
      if (!vocab) return null;
      return {
        kind: "vocab_match",
        teacherFleschKincaid: vocab.teacherFleschKincaid,
        targetGrade: vocab.targetGrade,
        deltaVsTarget: vocab.deltaVsTarget,
      };
    }
    default:
      return null;
  }
}
```

If `ReportSummary` is not currently re-exported from `@coachline/shared`, add it. Check `packages/shared/src/index.ts` — if missing, add:

```ts
export type {
  ReportSummary,
  // ...other report types already there
} from "./types/report";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/server/tests/routes/goal-progress-payload.test.ts`
Expected: PASS — all 8 cases green.

- [ ] **Step 5: Run full server test suite to confirm no regressions**

Run: `npm run -w @coachline/server test`
Expected: same green/skip count as before this task (33 passing, 4 skipped, plus the new 8). Ignore the pre-existing JWT_SECRET auth-route failure — that's tracked separately.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/goal-progress-payload.ts apps/server/tests/routes/goal-progress-payload.test.ts packages/shared/src/index.ts
git commit -m "feat(server): add buildPayload projection for goal-progress detail"
```

---

## Task 3: Wire buildPayload into the goals progress route

**Files:**
- Modify: `apps/server/src/routes/goals.ts:34-41`

- [ ] **Step 1: Update the `/:id/progress` handler to project payload**

Replace lines 34–41 of `apps/server/src/routes/goals.ts`:

```ts
fastify.get<{ Params: { id: string } }>("/:id/progress", async (request, reply) => {
  const goal = await getPrisma().goal.findFirst({
    where: { id: request.params.id, userId: request.userId },
  });
  if (!goal) return reply.status(404).send({ error: "not_found", message: "Goal not found" });

  const rows = await getPrisma().goalProgress.findMany({
    where: { goalId: goal.id, goal: { userId: request.userId } },
    orderBy: { createdAt: "asc" },
    include: {
      report: {
        select: {
          summary: true,
          createdAt: true,
          recording: { select: { title: true, recordedAt: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    goalId: row.goalId,
    reportId: row.reportId,
    value: row.value,
    createdAt: row.createdAt.toISOString(),
    payload: buildPayload(
      goal.practiceArea as PracticeArea,
      row.report.summary as unknown as ReportSummary
    ),
    // preserve existing nested fields the page already reads
    report: row.report,
  }));
});
```

Add the imports at the top of the file:

```ts
import type { PracticeArea, ReportSummary } from "@coachline/shared";
import { buildPayload } from "./goal-progress-payload";
```

Note: this preserves the existing response wrapper. Looking at `apps/server/web/src/app/(dashboard)/goals/[id]/page.tsx:50` the page calls `api.get<{ progress: GoalProgress[] }>(...)` — but the existing handler returns a bare array, not `{ progress: ... }`. **Verify the live shape before touching the page in Task 10.** If the existing handler returns a bare array, the page must already be doing `p.progress ?? []` defensively (it is — line 53). Keep returning the bare array for back-compat.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS for `apps/server` and `@coachline/shared`. The web app may still have type errors against the page; those are fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/goals.ts
git commit -m "feat(server): join report summary in goal progress endpoint"
```

---

## Task 4: Research-target table

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/lib/research-targets.ts`
- Test: _none_ (data-only constants — covered indirectly by the chart components)

- [ ] **Step 1: Create the targets module**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/lib/research-targets.ts`:

```ts
import type { PracticeArea } from "@coachline/shared";

export interface ResearchTarget {
  value: number;
  label: string;
  comparator: ">=" | "<=" | "between";
  band?: [number, number];
  source: string;
}

export const RESEARCH_TARGETS: Record<PracticeArea, ResearchTarget | null> = {
  wait_time:          { value: 3,    label: "≥3 seconds",                comparator: ">=",      source: "Rowe (1986)" },
  open_questions:     { value: 40,   label: "≥40% open",                  comparator: ">=",      source: "Walsh & Sattes" },
  student_talk_ratio: { value: 50,   label: "≥50% student talk",          comparator: ">=",      source: "50/50 rule" },
  uptake:             { value: 40,   label: "≥40% of student turns",      comparator: ">=",      source: "Nystrand" },
  dok_mix:            { value: 40,   label: "≥40% at DOK 3 or 4",         comparator: ">=",      source: "Webb" },
  praise_ratio:       { value: 4,    label: "4:1 specific to correction", comparator: ">=",      source: "PBIS / Sprick" },
  vocab_match:        { value: 0,    label: "within ±1 grade level",      comparator: "between", band: [-1, 1], source: "Hiebert" },
  equity_of_voice:    { value: 0.4,  label: "Gini ≤ 0.4",                 comparator: "<=",      source: "Lorenz/Gini convention" },
  dialogue_quality:   { value: 25,   label: "≥25% volleyball turns",      comparator: ">=",      source: "Mercer & Howe" },
  lesson_clarity:     { value: 3,    label: "3 of 3 elements detected",   comparator: ">=",      source: "Hattie" },
  custom:             null,
};

export function getResearchTarget(area: PracticeArea): ResearchTarget | null {
  return RESEARCH_TARGETS[area];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — exhaustive `Record<PracticeArea, ...>` mapping forces all 11 keys at compile time.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/lib/research-targets.ts
git commit -m "feat(web): add research-target table for goal-detail charts"
```

---

## Task 5: Shared chart props, EmptyChartState, LineChartWithTarget

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/GoalChartProps.ts`
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/EmptyChartState.tsx`
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/LineChartWithTarget.tsx`

- [ ] **Step 1: Create the shared prop interface**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/GoalChartProps.ts`:

```ts
import type { GoalProgress } from "@coachline/shared";
import type { ResearchTarget } from "../lib/research-targets";

export interface GoalChartProps {
  points: Array<{ date: string; value: number }>;
  progress: GoalProgress[];
  target: ResearchTarget | null;
}
```

- [ ] **Step 2: Create the empty-state component**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/EmptyChartState.tsx`:

```tsx
export function EmptyChartState({ message }: { message?: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
      {message ?? "Not enough data yet — complete more lessons to see a trend"}
    </div>
  );
}
```

- [ ] **Step 3: Create the line chart with target**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/LineChartWithTarget.tsx`:

```tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import type { GoalChartProps } from "./GoalChartProps";
import { EmptyChartState } from "./EmptyChartState";

export function LineChartWithTarget({ points, target }: GoalChartProps) {
  if (points.length < 2) {
    return <EmptyChartState />;
  }

  const referenceArea =
    target && target.comparator === "between" && target.band
      ? <ReferenceArea y1={target.band[0]} y2={target.band[1]} fill="#fbbf24" fillOpacity={0.08} />
      : null;

  const referenceLine =
    target && target.comparator !== "between"
      ? (
        <ReferenceLine
          y={target.value}
          stroke="#fbbf24"
          strokeDasharray="4 4"
          label={{ value: target.label, fill: "#fbbf24", fontSize: 11, position: "right" }}
        />
      ) : null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
          }}
          cursor={{ stroke: "rgba(139,92,246,0.3)" }}
        />
        {referenceArea}
        {referenceLine}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#8b5cf6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/components/
git commit -m "feat(web): extract LineChartWithTarget + shared chart props"
```

---

## Task 6: DokStackedBarChart

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/DokStackedBarChart.tsx`

- [ ] **Step 1: Create the component**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/DokStackedBarChart.tsx`:

```tsx
"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { GoalChartProps } from "./GoalChartProps";
import { EmptyChartState } from "./EmptyChartState";

interface DokRow {
  date: string;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  highDokPercent: number;  // L3+L4 percent — used by tooltip + reference comparison
}

const COLORS = {
  level1: "#475569",  // slate-600
  level2: "#7c8aa3",  // slate-400-ish
  level3: "#a78bfa",  // violet-400
  level4: "#7c3aed",  // violet-600
};

function toRows(progress: GoalChartProps["progress"]): DokRow[] {
  return progress
    .map((p) => {
      if (p.payload?.kind !== "dok_mix") return null;
      const total = p.payload.level1 + p.payload.level2 + p.payload.level3 + p.payload.level4;
      if (total === 0) return null;
      const pct = (n: number) => Math.round((n / total) * 1000) / 10; // 1 decimal
      const high = pct(p.payload.level3 + p.payload.level4);
      return {
        date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        level1: pct(p.payload.level1),
        level2: pct(p.payload.level2),
        level3: pct(p.payload.level3),
        level4: pct(p.payload.level4),
        highDokPercent: high,
      };
    })
    .filter((r): r is DokRow => r !== null);
}

export function DokStackedBarChart({ progress, target }: GoalChartProps) {
  const rows = toRows(progress);
  if (rows.length === 0) return <EmptyChartState />;

  return (
    <div className="h-full flex flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="level1" stackId="dok" fill={COLORS.level1} name="L1 Recall" />
          <Bar dataKey="level2" stackId="dok" fill={COLORS.level2} name="L2 Skill/Concept" />
          <Bar dataKey="level3" stackId="dok" fill={COLORS.level3} name="L3 Strategic" />
          <Bar dataKey="level4" stackId="dok" fill={COLORS.level4} name="L4 Extended" />
          {target && (
            <ReferenceLine
              y={100 - target.value}  // L3+L4 ≥ 40 ⇔ L1+L2 ≤ 60 — line drawn at the top of the L1+L2 stack
              stroke="#fbbf24"
              strokeDasharray="4 4"
              label={{ value: target.label, fill: "#fbbf24", fontSize: 11, position: "right" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Note the reference-line placement: stacked-bar reference lines apply to the cumulative y axis. To indicate "≥40% at L3+L4", draw the line at `y = 100 - 40 = 60` — meaning everything *above* the line is L3+L4 territory. The label uses the human-readable target string.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/components/DokStackedBarChart.tsx
git commit -m "feat(web): DOK stacked bar chart with L3+L4 reference"
```

---

## Task 7: PraiseRatioChart

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/PraiseRatioChart.tsx`

- [ ] **Step 1: Create the component**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/PraiseRatioChart.tsx`:

```tsx
"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { GoalChartProps } from "./GoalChartProps";
import { EmptyChartState } from "./EmptyChartState";

interface PraiseRow {
  date: string;
  specific: number;
  general: number;
  correction: number;
  ratio: number | null;
}

function toRows(progress: GoalChartProps["progress"]): PraiseRow[] {
  return progress
    .map((p) => {
      if (p.payload?.kind !== "praise_ratio") return null;
      return {
        date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        specific: p.payload.specific,
        general: p.payload.general,
        correction: p.payload.correction,
        ratio: p.payload.specificToCorrection,
      };
    })
    .filter((r): r is PraiseRow => r !== null);
}

export function PraiseRatioChart({ progress, target }: GoalChartProps) {
  const rows = toRows(progress);
  if (rows.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 4, right: 16, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="counts" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="ratio" orientation="right" tick={{ fill: "#a78bfa", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
        <Bar yAxisId="counts" dataKey="specific" fill="#22c55e" fillOpacity={0.7} name="Specific" />
        <Bar yAxisId="counts" dataKey="general" fill="#9ca3af" fillOpacity={0.6} name="General" />
        <Bar yAxisId="counts" dataKey="correction" fill="#f87171" fillOpacity={0.6} name="Correction" />
        <Line
          yAxisId="ratio"
          dataKey="ratio"
          type="monotone"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
          name="Specific:Correction"
          connectNulls={false}
        />
        {target && (
          <ReferenceLine
            yAxisId="ratio"
            y={target.value}
            stroke="#fbbf24"
            strokeDasharray="4 4"
            label={{ value: target.label, fill: "#fbbf24", fontSize: 11, position: "right" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/components/PraiseRatioChart.tsx
git commit -m "feat(web): praise-ratio composed chart with 4:1 reference"
```

---

## Task 8: VocabDeltaChart

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/components/VocabDeltaChart.tsx`

- [ ] **Step 1: Create the component**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/components/VocabDeltaChart.tsx`:

```tsx
"use client";

import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import type { GoalChartProps } from "./GoalChartProps";
import { EmptyChartState } from "./EmptyChartState";

interface VocabRow {
  date: string;
  delta: number;
  teacherFK: number | null;
  targetGrade: number | null;
}

function toRows(progress: GoalChartProps["progress"]): VocabRow[] {
  return progress
    .map((p) => {
      if (p.payload?.kind !== "vocab_match") return null;
      if (p.payload.deltaVsTarget === null) return null;
      return {
        date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        delta: p.payload.deltaVsTarget,
        teacherFK: p.payload.teacherFleschKincaid,
        targetGrade: p.payload.targetGrade,
      };
    })
    .filter((r): r is VocabRow => r !== null);
}

const IN_BAND = "#22c55e";
const OUT_BAND = "#fbbf24";

export function VocabDeltaChart({ progress, target }: GoalChartProps) {
  const rows = toRows(progress);
  if (rows.length === 0) return <EmptyChartState />;

  const band: [number, number] | null = target?.band ?? null;
  const inBand = (delta: number) => band !== null && delta >= band[0] && delta <= band[1];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        {band && (
          <ReferenceArea y1={band[0]} y2={band[1]} fill="#22c55e" fillOpacity={0.06} />
        )}
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
          formatter={(value: number, _name, item) => {
            const row = item.payload as VocabRow;
            return [
              `${value > 0 ? "+" : ""}${value.toFixed(1)} (teacher FK ${row.teacherFK?.toFixed(1) ?? "—"} vs target G${row.targetGrade ?? "—"})`,
              "Delta",
            ];
          }}
        />
        <Bar dataKey="delta">
          {rows.map((row, idx) => (
            <Cell key={idx} fill={inBand(row.delta) ? IN_BAND : OUT_BAND} fillOpacity={0.75} />
          ))}
        </Bar>
        {target && (
          <ReferenceLine
            y={target.value}
            stroke="#fbbf24"
            strokeDasharray="4 4"
            label={{ value: target.label, fill: "#fbbf24", fontSize: 11, position: "right" }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/components/VocabDeltaChart.tsx
git commit -m "feat(web): vocab-delta bar chart with ±1 grade band"
```

---

## Task 9: Dispatcher

**Files:**
- Create: `apps/server/web/src/app/(dashboard)/goals/[id]/lib/goal-detail-charts.ts`

- [ ] **Step 1: Create the dispatcher**

Create `apps/server/web/src/app/(dashboard)/goals/[id]/lib/goal-detail-charts.ts`:

```ts
import type { ComponentType } from "react";
import type { PracticeArea } from "@coachline/shared";
import { LineChartWithTarget } from "../components/LineChartWithTarget";
import { DokStackedBarChart } from "../components/DokStackedBarChart";
import { PraiseRatioChart } from "../components/PraiseRatioChart";
import { VocabDeltaChart } from "../components/VocabDeltaChart";
import type { GoalChartProps } from "../components/GoalChartProps";
import { getResearchTarget } from "./research-targets";

const BESPOKE: Partial<Record<PracticeArea, ComponentType<GoalChartProps>>> = {
  dok_mix: DokStackedBarChart,
  praise_ratio: PraiseRatioChart,
  vocab_match: VocabDeltaChart,
};

export function resolveGoalChart(area: PracticeArea) {
  return {
    Component: BESPOKE[area] ?? LineChartWithTarget,
    target: getResearchTarget(area),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/lib/goal-detail-charts.ts
git commit -m "feat(web): goal-detail chart dispatcher"
```

---

## Task 10: Wire dispatcher into goal-detail page

**Files:**
- Modify: `apps/server/web/src/app/(dashboard)/goals/[id]/page.tsx`

- [ ] **Step 1: Update area labels and replace inline chart**

Replace the entire contents of `apps/server/web/src/app/(dashboard)/goals/[id]/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Goal, GoalProgress } from "@coachline/shared";
import { resolveGoalChart } from "./lib/goal-detail-charts";

const AREA_LABELS: Record<string, string> = {
  wait_time: "Wait Time",
  open_questions: "Open Questions",
  student_talk_ratio: "Student Talk Ratio",
  uptake: "Uptake",
  dok_mix: "DOK Mix",
  praise_ratio: "Praise Ratio",
  vocab_match: "Vocab Match",
  equity_of_voice: "Equity of Voice",
  dialogue_quality: "Dialogue Quality",
  lesson_clarity: "Lesson Clarity",
  custom: "Custom",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  paused: "Paused",
};

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([
          api.get<Goal>(`/goals/${params.id}`),
          api.get<GoalProgress[] | { progress: GoalProgress[] }>(`/goals/${params.id}/progress`),
        ]);
        setGoal(g);
        // Endpoint returns a bare array today; tolerate either shape defensively.
        const list = Array.isArray(p) ? p : (p.progress ?? []);
        setProgress(list);
      } catch {
        setError("Failed to load goal");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const chartPoints = progress.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: p.value,
  }));

  const handleStatusChange = async (newStatus: Goal["status"]) => {
    if (!goal) return;
    setUpdating(true);
    try {
      const updated = await api.patch<Goal>(`/goals/${params.id}`, { status: newStatus });
      setGoal(updated);
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error || "Goal not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-400 hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  const latestValue = progress.length > 0 ? progress[progress.length - 1].value : null;
  const firstValue = progress.length > 0 ? progress[0].value : null;
  const trend =
    latestValue !== null && firstValue !== null && progress.length > 1
      ? latestValue - firstValue
      : null;

  const { Component: Chart, target } = resolveGoalChart(goal.practiceArea);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {goal.customLabel ?? AREA_LABELS[goal.practiceArea] ?? goal.practiceArea}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Target: {goal.targetMetric}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            goal.status === "active"
              ? "bg-green-500/10 text-green-400"
              : goal.status === "completed"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {STATUS_LABELS[goal.status] ?? goal.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-bold text-white">{progress.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sessions tracked</p>
        </div>
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p className="text-2xl font-bold text-white">
            {latestValue !== null ? latestValue.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Latest value</p>
        </div>
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 text-center">
          <p
            className={`text-2xl font-bold ${
              trend === null ? "text-white" : trend < 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Trend</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Progress Over Time
          </h2>
          {target && (
            <span className="text-xs text-gray-500">Research target: {target.label}</span>
          )}
        </div>
        <div className="h-56">
          <Chart points={chartPoints} progress={progress} target={target} />
        </div>
      </div>

      {/* Status controls */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Update Status
        </h2>
        <div className="flex gap-3">
          {(["active", "paused", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={updating || goal.status === s}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                goal.status === s
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                  : "bg-[#111] border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS across all workspaces.

- [ ] **Step 3: Commit**

```bash
git add apps/server/web/src/app/(dashboard)/goals/[id]/page.tsx
git commit -m "feat(web): wire goal-detail page to area-specific chart dispatcher"
```

---

## Task 11: Final verification

**Files:** _none_

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: PASS across `@coachline/server`, `@coachline/shared`, mobile, web.

- [ ] **Step 2: Full server tests**

Run: `npm run -w @coachline/server test`
Expected: previous count (33 passing, 4 skipped) + 8 new tests from Task 2 = 41 passing. The pre-existing `JWT_SECRET` auth-route failure remains; that is tracked separately and not introduced by this work.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Build (catches Next.js production issues)**

Run: `cd apps/server && npx next build web`
Expected: PASS.

- [ ] **Step 5: Manual smoke (dev mode)**

Run: `npm run dev` from repo root.

In a logged-in browser session:
1. Navigate to `/goals` and click into an existing goal that has at least one completed lesson. Confirm the right chart appears: line chart for `wait_time` / `open_questions` / `student_talk_ratio` / `uptake` / `equity_of_voice` / `dialogue_quality` / `lesson_clarity` / `custom`; stacked bar for `dok_mix`; composed bars+line for `praise_ratio`; signed bar with band for `vocab_match`.
2. Confirm the amber dashed reference line/label appears for non-`custom` areas with the research target.
3. For a goal with zero progress, confirm the "Not enough data yet" empty state shows.
4. Hover the DOK / Praise / Vocab charts and confirm the tooltips show the payload data, not just the bare `value`.
5. Confirm the 3-stat header row (sessions / latest / trend) is unchanged.
6. Open Network tab and confirm `/api/goals/<id>/progress` response includes the new `payload` field for the three bespoke areas.

- [ ] **Step 6: Run security scan**

Run: `$HOME/scripts/security_scan.sh`
Expected: no new HIGH/CRITICAL findings introduced by this change. Pre-existing worktree findings can be ignored if they were present before this branch — confirm by comparing against the scan run before Task 1.

- [ ] **Step 7: Push and watch deploy**

```bash
git push
```

Watch Render dashboard for the deploy. After it goes live, repeat Step 5 against production for at least one bespoke and one line-chart goal as smoke.

- [ ] **Step 8: Update shared memory**

Run `/handoff` to record what shipped and update `current-state.md` with the new "next actions" list (mark area-specific visualizations done; the next backlog items become research-blurb tooltips and AI confidence tiers).

---

## Self-review notes

**Spec coverage check:**
- §4 file map → Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ✓
- §5 data flow & types → Tasks 1, 2, 3 ✓
- §6 research targets → Task 4 ✓
- §7 chart components → Tasks 5, 6, 7, 8 ✓
- §8 dispatcher & page → Tasks 9, 10 ✓
- §9 testing → Task 2 (unit, comprehensive); §9.2 route tests are **deferred** in this plan — see note below
- §10 risks → Task 0 closes risk #3 in advance; risk #2 (Recharts cumulative reference line) is addressed in Task 6 by drawing the reference at `100 - target.value` against the inverted L1+L2 stack
- §11 scope guardrails → respected; nothing in the plan crosses the listed non-goals

**Deferred from spec §9.2:** Route-level integration tests for `/api/goals/:id/progress`. The repo's existing JWT auth setup for tests is broken (the pre-existing `JWT_SECRET` failure mentioned in current-state). Building a working DB-backed test rig is a larger effort than this feature warrants and is its own backlog item. The unit test in Task 2 covers the projection logic exhaustively; the route handler change (Task 3) is mechanical (4 lines of join + map). Manual verification in Task 11 covers the wire-shape end-to-end.

**Type consistency:** `GoalChartProps`, `ResearchTarget`, `GoalProgressPayload` are referenced consistently across tasks. `resolveGoalChart` is the single dispatcher. `buildPayload` signature `(area, summary) => Payload | null` matches the test in Task 2 and the call site in Task 3.

**Placeholder scan:** No "TBD", "TODO" implement-later, "add appropriate", or "similar to Task N" patterns. All code blocks complete.
