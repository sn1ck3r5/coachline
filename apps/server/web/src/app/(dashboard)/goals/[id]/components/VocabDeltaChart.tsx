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
          formatter={(value, _name, item) => {
            const numValue = typeof value === "number" ? value : Number(value);
            const row = item.payload as VocabRow;
            return [
              `${numValue > 0 ? "+" : ""}${numValue.toFixed(1)} (teacher FK ${row.teacherFK?.toFixed(1) ?? "—"} vs target G${row.targetGrade ?? "—"})`,
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
