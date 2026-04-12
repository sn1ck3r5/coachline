import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { DashPathEffect } from "@shopify/react-native-skia";

export interface GoalProgressChartProps {
  data: Array<{ date: string; value: number }>;
  targetValue?: number;
}

export default function GoalProgressChart({ data, targetValue }: GoalProgressChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  // Map to { x: index, value: number, target: number } for CartesianChart
  const hasTarget = targetValue !== undefined && !isNaN(targetValue);
  const chartData = data.map((d, i) => ({
    x: i,
    value: d.value,
    ...(hasTarget ? { target: targetValue! } : {}),
  }));

  // Y-axis range: pad slightly above the max and below the min
  const values = data.map((d) => d.value);
  const allValues = hasTarget ? [...values, targetValue!] : values;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.2 || 0.5;
  const yDomain: [number, number] = [
    Math.max(0, minVal - padding),
    maxVal + padding,
  ];

  const xLabels: Record<number, string> =
    data.length > 1
      ? { 0: shortDate(data[0].date), [data.length - 1]: shortDate(data[data.length - 1].date) }
      : { 0: shortDate(data[0].date) };

  const yKeys = hasTarget ? (["value", "target"] as ["value", "target"]) : (["value"] as ["value"]);

  return (
    <View style={styles.container}>
      <CartesianChart
        data={chartData}
        xKey="x"
        yKeys={yKeys}
        domain={{ y: yDomain }}
        axisOptions={{
          tickCount: { x: 2, y: 4 },
          labelColor: "#888",
          lineColor: "#333",
          labelOffset: { x: 4, y: 4 },
          formatXLabel: (v) => xLabels[v as number] ?? "",
          formatYLabel: (v) => String(Number(v).toFixed(1)),
        }}
      >
        {({ points }) => (
          <>
            <Line
              points={points.value}
              color="#3498db"
              strokeWidth={2.5}
              animate={{ type: "timing", duration: 500 }}
            />
            {hasTarget && "target" in points && (
              <Line
                points={(points as any).target}
                color="#8bc34a"
                strokeWidth={1.5}
              >
                <DashPathEffect intervals={[6, 4]} />
              </Line>
            )}
          </>
        )}
      </CartesianChart>

      {hasTarget && (
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: "#3498db" }]} />
          <Text style={styles.legendLabel}>Progress</Text>
          <View style={[styles.legendDot, { backgroundColor: "#8bc34a", marginLeft: 12 }]} />
          <Text style={styles.legendLabel}>Target ({targetValue})</Text>
        </View>
      )}
    </View>
  );
}

function shortDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  container: {
    height: 200,
  },
  empty: {
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#555",
    fontSize: 14,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: "#888",
  },
});
