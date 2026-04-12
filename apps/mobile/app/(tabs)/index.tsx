import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import type { Goal, GoalProgress, LessonReport, PaginatedResponse } from "@coachline/shared";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatWaitTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function practiceAreaLabel(area: string): string {
  const labels: Record<string, string> = {
    wait_time: "Increase think time",
    open_questions: "Ask more open-ended questions",
    student_talk_ratio: "Increase student talk ratio",
    uptake: "Build on student ideas",
    custom: "Custom goal",
  };
  return labels[area] ?? area;
}

// ─── Active Goal Card ─────────────────────────────────────────────────────────

interface ActiveGoalCardProps {
  goal: Goal;
  progress: GoalProgress[];
}

function ActiveGoalCard({ goal, progress }: ActiveGoalCardProps) {
  const target = parseFloat(goal.targetMetric);
  const latest = progress.length > 0 ? progress[progress.length - 1].value : null;
  const earliest = progress.length > 0 ? progress[0].value : null;
  const percent =
    latest !== null && !isNaN(target) && target > 0
      ? Math.min(100, Math.round((latest / target) * 100))
      : null;

  const label = goal.customLabel ?? practiceAreaLabel(goal.practiceArea);

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalCardHeader}>
        <Text style={styles.goalCardLabel}>ACTIVE GOAL</Text>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>
      <Text style={styles.goalCardTitle}>{label}</Text>
      <Text style={styles.goalCardTarget}>Target: {goal.targetMetric}</Text>

      {percent !== null && (
        <>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${percent}%` as `${number}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{percent}% toward target</Text>
        </>
      )}

      {latest !== null && (
        <Text style={styles.currentValue}>
          Current: {latest.toFixed(2)}
          {earliest !== null && earliest !== latest
            ? ` — up from ${earliest.toFixed(2)}`
            : ""}
        </Text>
      )}
    </View>
  );
}

// ─── Lesson Row ───────────────────────────────────────────────────────────────

interface LessonRowProps {
  report: LessonReport;
  onPress: () => void;
}

function LessonRow({ report, onPress }: LessonRowProps) {
  const { summary } = report;
  const avgWaitMs =
    summary.waitTime.waitTime1Count > 0
      ? summary.waitTime.waitTime1AvgMs
      : summary.waitTime.waitTime2AvgMs;

  return (
    <TouchableOpacity style={styles.lessonRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.lessonRowLeft}>
        <Text style={styles.lessonRowTitle} numberOfLines={1}>
          {formatDate(report.createdAt)}
        </Text>
        <View style={styles.lessonRowStats}>
          <Text style={styles.lessonRowStat}>
            {Math.round(summary.talkTime.studentPercent)}% student talk
          </Text>
          <Text style={styles.lessonRowStatSep}>·</Text>
          <Text style={styles.lessonRowStat}>
            {summary.questions.openEnded} open Qs
          </Text>
          <Text style={styles.lessonRowStatSep}>·</Text>
          <Text style={styles.lessonRowStat}>
            {formatWaitTime(avgWaitMs)} wait
          </Text>
        </View>
      </View>
      <Text style={styles.lessonRowChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.skeletonText}>Loading dashboard…</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [reports, setReports] = useState<LessonReport[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [goals, { data: recentReports }] = await Promise.all([
        api.get<Goal[]>("/goals"),
        api.get<PaginatedResponse<LessonReport>>("/reports?limit=5"),
      ]);

      const found = goals.find((g) => g.status === "active") ?? null;
      setActiveGoal(found);
      setReports(recentReports);

      if (found) {
        const goalProgress = await api.get<GoalProgress[]>(`/goals/${found.id}/progress`);
        setProgress(goalProgress);
      }
    } catch {
      // Silently degrade — dashboard still renders with empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()},{"\n"}
              <Text style={styles.greetingName}>{user?.name ?? "Teacher"}</Text>
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(user?.name ?? "T").charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Active Goal ── */}
        {activeGoal ? (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/goals/${activeGoal.id}` as any)}
            activeOpacity={0.85}
          >
            <ActiveGoalCard goal={activeGoal} progress={progress} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.noGoalCard}
            onPress={() => router.push("/(tabs)/goals" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.noGoalTitle}>No active goal</Text>
            <Text style={styles.noGoalSubtitle}>Tap to set a practice goal →</Text>
          </TouchableOpacity>
        )}

        {/* ── Recent Lessons ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>RECENT LESSONS</Text>
          {reports.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No lessons yet. Tap Record to get started.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {reports.map((report, i) => (
                <React.Fragment key={report.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <LessonRow
                    report={report}
                    onPress={() => router.push(`/(tabs)/lessons/${report.id}` as any)}
                  />
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Bottom spacer for record button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Big Record Button ── */}
      <View style={styles.recordButtonContainer}>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={() => router.push("/(tabs)/record" as any)}
          activeOpacity={0.85}
        >
          <View style={styles.recordButtonInner} />
        </TouchableOpacity>
        <Text style={styles.recordButtonLabel}>Record</Text>
      </View>
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
    paddingTop: 16,
    paddingBottom: 120,
  },

  // Loading
  skeletonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  skeletonText: {
    color: "#888",
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: "#888",
    lineHeight: 24,
  },
  greetingName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  // Active goal card
  goalCard: {
    backgroundColor: "#132213",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1e3d1e",
  },
  goalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  goalCardLabel: {
    fontSize: 11,
    color: "#8bc34a",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  activeBadge: {
    backgroundColor: "#1e3d1e",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: 11,
    color: "#8bc34a",
    fontWeight: "600",
  },
  goalCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  goalCardTarget: {
    fontSize: 13,
    color: "#8bc34a",
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#1e3d1e",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#8bc34a",
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 12,
    color: "#8bc34a",
    marginBottom: 6,
  },
  currentValue: {
    fontSize: 13,
    color: "#aaa",
  },

  // No goal
  noGoalCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderStyle: "dashed",
    alignItems: "center",
  },
  noGoalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
    marginBottom: 4,
  },
  noGoalSubtitle: {
    fontSize: 13,
    color: "#3b82f6",
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

  // Card
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },

  // Lesson row
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lessonRowLeft: {
    flex: 1,
  },
  lessonRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  lessonRowStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  lessonRowStat: {
    fontSize: 12,
    color: "#888",
  },
  lessonRowStatSep: {
    fontSize: 12,
    color: "#555",
  },
  lessonRowChevron: {
    fontSize: 20,
    color: "#555",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 16,
  },

  // Record button
  recordButtonContainer: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e74c3c",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#e74c3c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  recordButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  recordButtonLabel: {
    fontSize: 12,
    color: "#888",
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: 32,
  },
});
