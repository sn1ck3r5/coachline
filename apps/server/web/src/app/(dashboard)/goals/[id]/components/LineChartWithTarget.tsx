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
