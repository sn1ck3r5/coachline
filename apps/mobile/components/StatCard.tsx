import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatCardProps {
  value: string | number;
  label: string;
}

export default function StatCard({ value, label }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },
});
