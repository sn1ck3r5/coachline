import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Goal, GoalProgress } from "@coachline/shared";
import { api } from "../../../lib/api";
import GoalProgressChart from "../../../components/GoalProgressChart";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: Goal["status"]): string {
  if (status === "active") return "#2ecc71";
  if (status === "completed") return "#3b82f6";
  return "#888";
}

function statusLabel(status: Goal["status"]): string {
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Paused";
}

function practiceAreaLabel(area: string, customLabel: string | null): string {
  if (area === "custom") return customLabel ?? "Custom goal";
  const labels: Record<string, string> = {
    wait_time: "Increase think time",
    open_questions: "Ask more open-ended questions",
    student_talk_ratio: "Increase student talk ratio",
    uptake: "Build on student ideas",
  };
  return labels[area] ?? area;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GoalProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [goalData, progressData] = await Promise.all([
        api.get<Goal>(`/goals/${id}`),
        api.get<GoalProgress[]>(`/goals/${id}/progress`),
      ]);
      setGoal(goalData);
      setProgress(progressData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading goal…</Text>
      </View>
    );
  }

  if (error || !goal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Goal not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const label = practiceAreaLabel(goal.practiceArea, goal.customLabel);
  const color = statusColor(goal.status);

  // Chart data
  const chartData = progress.map((p) => ({ date: p.createdAt, value: p.value }));
  const targetValue = parseFloat(goal.targetMetric);
  const targetNum = isNaN(targetValue) ? undefined : targetValue;

  // Stats
  const values = progress.map((p) => p.value);
  const startingValue = values.length > 0 ? values[0] : null;
  const currentValue = values.length > 0 ? values[values.length - 1] : null;
  const lessonCount = progress.length;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back ── */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Goals</Text>
        </TouchableOpacity>

        {/* ── Goal Info ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.goalLabel} numberOfLines={2}>{label}</Text>
            <View style={[styles.statusBadge, { borderColor: color }]}>
              <Text style={[styles.statusBadgeText, { color }]}>{statusLabel(goal.status)}</Text>
            </View>
          </View>
          <Text style={styles.targetText}>Target: {goal.targetMetric}</Text>
          <Text style={styles.createdText}>Started {formatDate(goal.createdAt)}</Text>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {startingValue !== null ? startingValue.toFixed(2) : "—"}
            </Text>
            <Text style={styles.statLabel}>Starting</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {currentValue !== null ? currentValue.toFixed(2) : "—"}
            </Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{lessonCount}</Text>
            <Text style={styles.statLabel}>Lessons</Text>
          </View>
        </View>

        {/* ── Trend Chart ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PROGRESS OVER TIME</Text>
          <View style={styles.chartCard}>
            <GoalProgressChart data={chartData} targetValue={targetNum} />
          </View>
        </View>

        {/* ── Lesson Data Points ── */}
        {progress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>LESSON DATA POINTS</Text>
            <View style={styles.card}>
              {progress.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.dataPointRow}>
                    <View style={styles.dataPointLeft}>
                      <Text style={styles.dataPointDate}>{formatDate(p.createdAt)}</Text>
                      <Text style={styles.dataPointReportId} numberOfLines={1}>
                        Report {p.reportId.slice(0, 8)}…
                      </Text>
                    </View>
                    <Text style={styles.dataPointValue}>{p.value.toFixed(2)}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    gap: 12,
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
  },
  retryLabel: {
    color: "#fff",
    fontSize: 14,
  },

  // Back
  back: {
    paddingVertical: 16,
  },
  backText: {
    fontSize: 16,
    color: "#3b82f6",
  },

  // Info card
  infoCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  goalLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  targetText: {
    fontSize: 14,
    color: "#8bc34a",
    marginBottom: 4,
  },
  createdText: {
    fontSize: 13,
    color: "#666",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 24,
    overflow: "hidden",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#2a2a2a",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  // Chart card
  chartCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },

  // Generic card
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
  },

  // Data points
  dataPointRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dataPointLeft: {
    flex: 1,
  },
  dataPointDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  dataPointReportId: {
    fontSize: 12,
    color: "#555",
  },
  dataPointValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3b82f6",
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 16,
  },
});
