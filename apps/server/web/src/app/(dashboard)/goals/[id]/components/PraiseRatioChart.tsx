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
