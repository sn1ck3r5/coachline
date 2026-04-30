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
  highDokPercent: number;
}

const COLORS = {
  level1: "#475569",
  level2: "#7c8aa3",
  level3: "#a78bfa",
  level4: "#7c3aed",
};

function toRows(progress: GoalChartProps["progress"]): DokRow[] {
  return progress
    .map((p) => {
      if (p.payload?.kind !== "dok_mix") return null;
      const total = p.payload.level1 + p.payload.level2 + p.payload.level3 + p.payload.level4;
      if (total === 0) return null;
      const pct = (n: number) => Math.round((n / total) * 1000) / 10;
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
            formatter={(value, name) => [`${value}%`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="level1" stackId="dok" fill={COLORS.level1} name="L1 Recall" />
          <Bar dataKey="level2" stackId="dok" fill={COLORS.level2} name="L2 Skill/Concept" />
          <Bar dataKey="level3" stackId="dok" fill={COLORS.level3} name="L3 Strategic" />
          <Bar dataKey="level4" stackId="dok" fill={COLORS.level4} name="L4 Extended" />
          {target && (
            <ReferenceLine
              y={100 - target.value}
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
