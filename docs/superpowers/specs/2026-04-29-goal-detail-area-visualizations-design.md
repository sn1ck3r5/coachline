# Goal-detail area-specific visualizations — design

**Date**: 2026-04-29
**Status**: Approved (pending written-spec review)
**Scope**: `apps/server` — web frontend + one API route
**Predecessors**: 2026-04-26 evidence-backed lesson report (shipped to prod 2026-04-28)

## 1. Problem

`/goals/[id]` today renders a single Recharts line chart of `GoalProgress.value` over time, identical for every practice area. With 11 practice areas now in scope (8 prior + 3 added in the evidence-backed report work), a generic line chart hides each area's actual story:

- **DOK mix** is a 4-level distribution per lesson, not a scalar.
- **Praise ratio** is two related counts (specific / correction) plus a research-backed 4:1 target.
- **Vocab match** is a *signed* delta against zero, where direction matters.

The line chart also has no reference line, so a teacher can't see whether the latest value is on or off the research-backed target.

## 2. Goals

1. Replace the line chart with an area-specific visualization for `dok_mix`, `praise_ratio`, and `vocab_match`.
2. For the other 8 practice areas, add a research-backed target reference line/band to the existing line chart.
3. Match the existing card aesthetic and metric-card folder convention.
4. No schema migration. No persistence changes.

## 3. Non-goals

- Schema changes (no new column on `GoalProgress`).
- Parsing `Goal.targetMetric`. The user's free-form target stays in the page header; the reference line uses the research-backed target. If divergence becomes confusing, that's a future spec.
- Wiring the dispatcher into the dashboard home page or mobile.
- Redesigning the 3-stat header row, status controls, or page chrome.
- Research-blurb tooltips on practice-area names (separate backlog item).
- AI confidence tiers (separate backlog item).
- Fixing the pre-existing `JWT_SECRET` auth-route test (separate backlog item).

## 4. Architecture

### 4.1 File map

```
packages/shared/src/
  types/goal.ts                         # extend GoalProgress with payload union
  index.ts                              # re-export new payload types

apps/server/src/routes/
  goals.ts                              # /goals/:id/progress now joins LessonReport.summary
  goal-progress-payload.ts              # NEW — buildPayload(area, summary)

apps/server/web/src/app/(dashboard)/goals/[id]/
  page.tsx                              # replace inline LineChart with dispatcher
  components/
    GoalChartProps.ts                   # NEW — shared prop interface for all chart components
    LineChartWithTarget.tsx             # NEW — shared, used by 8 simple areas
    DokStackedBarChart.tsx              # NEW — DOK 4-level stacked bar per session
    PraiseRatioChart.tsx                # NEW — specific/general/correction grouped bars + 4:1 ref
    VocabDeltaChart.tsx                 # NEW — signed delta bars vs zero
    EmptyChartState.tsx                 # NEW — shared "Not enough data yet" panel
  lib/
    goal-detail-charts.ts               # NEW — dispatcher: practiceArea → { Component, target }
    research-targets.ts                 # NEW — 11-row target table

apps/server/tests/
  pipeline/goal-progress-payload.test.ts # NEW — unit tests for buildPayload
  routes/goals-progress.test.ts          # NEW — route tests, one per bespoke area
```

### 4.2 Layering

`research-targets.ts` is data-only (no React) — keyed by `PracticeArea`, exports `getResearchTarget(area)` returning `ResearchTarget | null`. Plain TS, easy to test.

`goal-detail-charts.ts` imports the chart components and the targets, exports `resolveGoalChart(area)` returning `{ Component, target }`. The dispatcher pattern can later be reused on the dashboard home page or mobile without dragging chart components transitively.

`page.tsx` resolves once on render and passes `progress` + `target` to the chosen component.

## 5. Data flow & types

### 5.1 Shared type (`packages/shared/src/types/goal.ts`)

```ts
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

`payload.kind` discriminates on the goal's `practiceArea` but is intentionally a separate field rather than derived from `Goal.practiceArea` at the type level so that:

1. Older reports missing the relevant `summary` slice can return `payload: null` defensively.
2. Goals whose area was changed mid-stream don't break (we treat the goal's *current* area as the source of truth at read time).

### 5.2 API change

`GET /api/goals/:id/progress` (`apps/server/src/routes/goals.ts`)

Today: `prisma.goalProgress.findMany({ where: { goalId }, orderBy })`.

After:
```ts
const rows = await prisma.goalProgress.findMany({
  where: { goalId, goal: { userId: request.userId } },
  orderBy: { createdAt: "asc" },
  include: { report: { select: { summary: true } } },
});

return {
  progress: rows.map((row) => ({
    id: row.id,
    goalId: row.goalId,
    reportId: row.reportId,
    value: row.value,
    createdAt: row.createdAt.toISOString(),
    payload: buildPayload(goal.practiceArea, row.report.summary as ReportSummary),
  })),
};
```

`buildPayload` lives in `apps/server/src/routes/goal-progress-payload.ts`:

- `dok_mix` → projects `summary.questions.dok` (counts at L1–L4 + unclassified).
- `praise_ratio` → projects `summary.praise` (specific / general / correction + `specificToCorrection` derived as `correction === 0 ? null : specific / correction`).
- `vocab_match` → projects `summary.vocabGradeLevel`.
- Anything else → `null`.

Returns `null` (not `undefined`, not throw) if the summary slice is missing — older reports that predate any of the data being computed should still render the line chart on the bare `value`.

### 5.3 Authorization

Existing handler already filters by `userId` via the goal lookup. The new `where: { goal: { userId } }` is a relational guard so a stray `goalId` from another user can't reach the join. No new attack surface.

### 5.4 Mobile/Expo

`apps/mobile` does not consume `/goals/:id/progress` today. Out of scope.

## 6. Research-backed targets

Source of truth: `apps/server/web/src/app/(dashboard)/goals/[id]/lib/research-targets.ts`.

```ts
export interface ResearchTarget {
  value: number;
  label: string;            // user-visible, e.g. "≥40% open"
  comparator: ">=" | "<=" | "between";
  band?: [number, number];  // only when comparator === "between"
  source: string;           // citation, e.g. "Rowe (1986)"
}

export const RESEARCH_TARGETS: Record<PracticeArea, ResearchTarget | null> = {
  wait_time:           { value: 3,   label: "≥3 seconds",                comparator: ">=",      source: "Rowe (1986)" },
  open_questions:      { value: 40,  label: "≥40% open",                  comparator: ">=",      source: "Walsh & Sattes" },
  student_talk_ratio:  { value: 50,  label: "≥50% student talk",          comparator: ">=",      source: "50/50 rule" },
  uptake:              { value: 40,  label: "≥40% of student turns",      comparator: ">=",      source: "Nystrand" },
  dok_mix:             { value: 40,  label: "≥40% at DOK 3 or 4",         comparator: ">=",      source: "Webb" },
  praise_ratio:        { value: 4,   label: "4:1 specific to correction", comparator: ">=",      source: "PBIS / Sprick" },
  vocab_match:         { value: 0,   label: "within ±1 grade level",      comparator: "between", band: [-1, 1], source: "Hiebert" },
  equity_of_voice:     { value: 0.4, label: "Gini ≤ 0.4",                 comparator: "<=",      source: "Lorenz/Gini convention" },
  dialogue_quality:    { value: 25,  label: "≥25% volleyball turns",      comparator: ">=",      source: "Mercer & Howe" },
  lesson_clarity:      { value: 3,   label: "3 of 3 elements detected",   comparator: ">=",      source: "Hattie" },
  custom:              null,
};
```

## 7. Chart components

All four follow the existing card aesthetic: `#1a1a1a` panel, `border-white/5`, `rounded-xl`, axis ticks `#6b7280`, primary accent violet `#8b5cf6`, reference line/band amber `#fbbf24` with dashed stroke. All render inside an `h-56` container via Recharts' `ResponsiveContainer`.

### 7.1 `LineChartWithTarget.tsx` (used by 8 areas)

```ts
interface Props {
  points: Array<{ date: string; value: number }>;
  target: ResearchTarget | null;
  yAxisLabel?: string;
}
```

- Existing line chart logic, lifted out verbatim from `page.tsx`.
- When `target` is non-null, adds `<ReferenceLine y={target.value} stroke="#fbbf24" strokeDasharray="4 4" />` with a small label.
- For `comparator: "between"` (vocab uses the bespoke chart, but `equity_of_voice` is `<=` and is rendered with a single line — `between` is held in reserve), renders `<ReferenceArea>` instead.
- Empty / single-point fallback delegates to `<EmptyChartState>`.

### 7.2 `DokStackedBarChart.tsx` (`dok_mix`)

- One stacked bar per session along the X axis.
- Y axis: percent (0–100). Each bar's segments sum to 100.
- 4 segments per bar, color-graded L1 (lighter slate) → L4 (deep violet), so "more L3+L4" reads as visually denser/darker.
- Reference line at y=40 against the *cumulative L3+L4* stack — implemented by adding an invisible cumulative series for L3+L4 plus a `<ReferenceLine y={40}>`. Validated as the first task of implementation (see §10 risks).
- Tooltip on hover shows the four counts + the L3+L4 percent.
- Legend below: 4 levels + "Target: ≥40% of questions at DOK 3 or 4 (Webb)".
- Single-point: render the one bar (a stack of one is meaningful, unlike a one-point line).

### 7.3 `PraiseRatioChart.tsx` (`praise_ratio`)

- Grouped bars per session: three bars (specific / general / correction) under each date.
- Specific bar = green-500/70; general = gray-400/60; correction = red-400/60.
- Secondary Y axis on the right: per-session **specific-to-correction ratio** as a violet-500 line.
- Reference line on the secondary axis at y=4 (the 4:1 PBIS target). Reasoning: a count-based reference line is misleading because praise/correction counts depend on lesson length; the ratio normalizes that.
- Below the chart: "Target: 4:1 specific praise to corrections (PBIS / Sprick)."
- Empty / single-point: render the one session as bars + dot; no warning.

### 7.4 `VocabDeltaChart.tsx` (`vocab_match`)

- One bar per session, vertical, value = `payload.deltaVsTarget` (signed: positive = teacher language above target grade).
- Bars centered on a y=0 reference line (zero baseline emphasized).
- Light shaded `<ReferenceArea>` between y=-1 and y=+1 (the target band).
- Bars inside the band = green; outside = amber.
- Tooltip shows teacher FK, target grade, signed delta.
- "Target: within ±1 grade level of student target (Hiebert / readability bands)" beneath.
- Empty / single-point: render the one bar.

### 7.5 Empty / fallback behavior

- Older reports missing the relevant `summary` slice produce `payload: null`. Each bespoke chart filters its `progress` array down to rows where `payload?.kind === <its kind>`. If the filter leaves zero rows, the bespoke chart renders `<EmptyChartState />` (it does not silently fall back to a line chart — that would be confusing for `dok_mix` where a bare `value` has no clear interpretation).
- The `<EmptyChartState>` helper renders the same "Not enough data yet — complete more lessons to see a trend" message used today by the line chart.

## 8. Dispatcher & page composition

### 8.1 Shared chart props

All four chart components implement the same prop contract so the dispatcher can call them uniformly:

```ts
import type { GoalProgress } from "@coachline/shared";
import type { ResearchTarget } from "./research-targets";

export interface GoalChartProps {
  // Lightweight (date, value) projection, passed to every component for header
  // calculations. Bespoke charts ignore this and read from `progress`.
  points: Array<{ date: string; value: number }>;
  // Full progress rows including the typed payload. Used by bespoke charts.
  progress: GoalProgress[];
  target: ResearchTarget | null;
}
```

### 8.2 `goal-detail-charts.ts`

```ts
import type { ComponentType } from "react";
import type { PracticeArea } from "@coachline/shared";
import { LineChartWithTarget } from "../components/LineChartWithTarget";
import { DokStackedBarChart } from "../components/DokStackedBarChart";
import { PraiseRatioChart } from "../components/PraiseRatioChart";
import { VocabDeltaChart } from "../components/VocabDeltaChart";
import { getResearchTarget } from "./research-targets";
import type { GoalChartProps } from "../components/GoalChartProps";

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

### 8.3 `goals/[id]/page.tsx` changes

- Drop the inline `LineChart` block.
- Extend `AREA_LABELS` to all 11 areas (current map only has 5).
- Replace the chart panel body with:

```tsx
const { Component: Chart, target } = resolveGoalChart(goal.practiceArea);
// ...
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
    <Chart points={chartData} progress={progress} target={target} />
  </div>
</div>
```

- Bespoke charts get the full `progress` array (typed `GoalProgress[]`) so they can read each row's `payload`. `LineChartWithTarget` consumes `points` + `target` and ignores `progress`.
- The 3-stat header row (sessions / latest / trend) stays as-is.

## 9. Testing

### 9.1 Unit (vitest, no DB)

`apps/server/tests/pipeline/goal-progress-payload.test.ts` — table-driven tests for `buildPayload(area, summary)`:

- `dok_mix` → returns `{ kind: "dok_mix", level1..level4, unclassified }` matching the input.
- `praise_ratio` → returns counts + `specificToCorrection`; null ratio when `correction === 0`.
- `vocab_match` → returns the three nullable fields.
- Any other area → `null`.
- Missing summary slice → `null` (defensive — no throw).

### 9.2 Route (vitest + ephemeral Postgres)

`apps/server/tests/routes/goals-progress.test.ts` — one test per bespoke area:

- Seed user → goal (`practiceArea` = X) → recording → report with realistic `summary` JSONB → `GoalProgress` row.
- `GET /api/goals/:id/progress` returns `payload.kind === X` with values matching the seeded summary.
- One auth test: another user's goal returns 404.

### 9.3 No frontend tests

The chart components are visual; no frontend test harness exists in this repo today. Manual verification covers them.

### 9.4 Manual verification (in implementation plan)

1. `npm run typecheck` clean across workspaces.
2. `npm run -w @coachline/server test` green.
3. Local `npm run dev`: create one goal per practice area, seed enough progress to render. Confirm each area renders the right component, the reference line/band appears at the right y-value, empty state shows for goals with 0 progress, DOK / Praise / Vocab tooltips show payload data.
4. Render production smoke after deploy: load existing goal-detail page, ensure no regression on a `wait_time` or `open_questions` goal that already has historical progress.

## 10. Risks & open items

| Risk | Mitigation |
|---|---|
| `LessonReport.summary` shape drift between when a progress row was written and now | `buildPayload` reads via the `ReportSummary` TS type and silently returns `null` on missing fields — chart falls back to plain `value` line |
| Recharts stacked-bar + reference-line interaction has known quirks for cumulative-stack thresholds | First task of the implementation plan: spike the L3+L4 reference line approach before building the rest of the DOK chart |
| Pipeline-stored `value` for `vocab_match` / `praise_ratio` may not be the scalar we want to plot | First task of implementation plan: read `apps/server/src/pipeline/orchestrator.ts` persistence step; if mismatched, either change persist OR change the chart's hover-display, whichever is smaller |

## 11. Scope guardrails

Restated for clarity at implementation time:

- **Not** changing the schema. `GoalProgress.payload` is computed at read time, never persisted.
- **Not** wiring the dispatcher into the dashboard home page or mobile yet.
- **Not** redesigning the 3-stat header row, status controls, or page chrome.
- **Not** parsing `Goal.targetMetric`.
- **Not** adding research-blurb tooltips on practice-area names.
- **Not** touching AI confidence tiers.
- **Not** fixing the pre-existing `JWT_SECRET` auth-route test.
