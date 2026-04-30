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
