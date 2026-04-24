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
import { useLocalSearchParams } from "expo-router";
import type { LessonReport, Transcript, Insight } from "@coachline/shared";
import { api } from "../../../lib/api";
import LessonTimeline from "../../../components/LessonTimeline";
import StatCard from "../../../components/StatCard";
import HighlightCard from "../../../components/HighlightCard";
import AudioPlayer from "../../../components/AudioPlayer";

// ─── Format helpers ────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatWaitTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  science: "Science",
  social_studies: "Social Studies",
  other: "Other",
};

function formatSubjectTopic(
  subject: string | null | undefined,
  topic: string | null | undefined
): string | null {
  const s = subject ? SUBJECT_LABELS[subject] ?? subject : null;
  if (s && topic) return `${s} · ${topic}`;
  return s ?? topic ?? null;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function LessonReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [report, setReport] = useState<LessonReport | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seekToMs, setSeekToMs] = useState<number | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const [reportData, transcriptData, insightData, audioData] =
        await Promise.all([
          api.get<LessonReport>(`/reports/${id}`),
          api.get<Transcript>(`/reports/${id}/transcript`),
          api.get<Insight[]>(`/reports/${id}/insights`),
          api.get<{ url: string }>(`/reports/${id}/audio-url`),
        ]);

      setReport(reportData);
      setTranscript(transcriptData);
      setInsights(insightData);
      setAudioUrl(audioData.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load lesson report"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlay = useCallback((startMs: number) => {
    setSeekToMs(startMs);
  }, []);

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2ecc71" />
        <Text style={styles.loadingText}>Loading report…</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Report not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary } = report;
  const avgWaitMs =
    summary.waitTime.waitTime1Count > 0
      ? summary.waitTime.waitTime1AvgMs
      : summary.waitTime.waitTime2AvgMs;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Lesson Report</Text>
          <Text style={styles.date}>{formatDate(report.createdAt)}</Text>
          {formatSubjectTopic(summary.subject, summary.topic) && (
            <Text style={styles.subtopic}>
              {formatSubjectTopic(summary.subject, summary.topic)}
            </Text>
          )}
        </View>

        {/* ── Talk Time ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TALK TIME</Text>
          <View style={styles.card}>
            <LessonTimeline talkTime={summary.talkTime} />
          </View>
        </View>

        {/* ── Stats Grid ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>METRICS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                value={summary.questions.total}
                label="Questions Asked"
              />
              <StatCard
                value={summary.questions.openEnded}
                label="Open-Ended"
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                value={formatWaitTime(avgWaitMs)}
                label="Avg Wait Time"
              />
              <StatCard
                value={summary.uptakeCount}
                label="Uptake Moments"
              />
            </View>
            {summary.questions?.dok && (() => {
              const d = summary.questions.dok;
              const classified = d.level1 + d.level2 + d.level3 + d.level4;
              const deepPct =
                classified > 0
                  ? Math.round(((d.level3 + d.level4) / classified) * 100)
                  : 0;
              return (
                <View style={styles.statsRow}>
                  <StatCard value={`${deepPct}%`} label="DOK 3-4 (Deep)" />
                  <StatCard
                    value={summary.praise?.specific ?? 0}
                    label="Specific Praise"
                  />
                </View>
              );
            })()}
            <View style={styles.statsRow}>
              <StatCard
                value={
                  summary.praise?.praiseToCorrectionRatio !== null &&
                  summary.praise?.praiseToCorrectionRatio !== undefined
                    ? summary.praise.praiseToCorrectionRatio.toFixed(1)
                    : "—"
                }
                label="Praise : Correction"
              />
              <StatCard
                value={
                  summary.vocabGradeLevel?.teacherFleschKincaid !== null &&
                  summary.vocabGradeLevel?.teacherFleschKincaid !== undefined
                    ? summary.vocabGradeLevel.teacherFleschKincaid.toFixed(1)
                    : "—"
                }
                label={
                  summary.vocabGradeLevel?.deltaVsTarget !== null &&
                  summary.vocabGradeLevel?.deltaVsTarget !== undefined
                    ? `Vocab FK (${summary.vocabGradeLevel.deltaVsTarget > 0 ? "+" : ""}${summary.vocabGradeLevel.deltaVsTarget.toFixed(1)})`
                    : "Vocab FK"
                }
              />
            </View>
          </View>
        </View>

        {/* ── Highlighted Moments ── */}
        {report.highlightedMoments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>HIGHLIGHTS</Text>
            {report.highlightedMoments.map((moment, i) => (
              <HighlightCard
                key={i}
                title={moment.title}
                description={moment.description}
                startMs={moment.startMs}
                onPlay={handlePlay}
              />
            ))}
          </View>
        )}

        {/* ── Reflection Prompts ── */}
        {report.reflectionPrompts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>REFLECTION PROMPTS</Text>
            <View style={styles.card}>
              {report.reflectionPrompts.map((prompt, i) => (
                <View key={i} style={i > 0 ? styles.promptSpacer : undefined}>
                  <Text style={styles.promptText}>• {prompt}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Transcript ── */}
        {transcript && transcript.segments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>TRANSCRIPT</Text>
            <View style={styles.transcriptContainer}>
              {transcript.segments.map((seg, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.transcriptSegment,
                    seg.speaker === "teacher"
                      ? styles.teacherSegment
                      : styles.studentSegment,
                  ]}
                  onPress={() => handlePlay(seg.startMs)}
                  activeOpacity={0.7}
                >
                  <View style={styles.transcriptMeta}>
                    <Text style={styles.transcriptSpeaker}>
                      {seg.speaker === "teacher" ? "Teacher" : "Student"}
                    </Text>
                    <Text style={styles.transcriptTime}>
                      {formatDuration(seg.startMs)}
                    </Text>
                  </View>
                  <Text style={styles.transcriptText}>{seg.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bottom padding so content isn't hidden behind AudioPlayer */}
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── Audio Player (sticky bottom) ── */}
      <AudioPlayer audioUrl={audioUrl} seekToMs={seekToMs} />
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
    marginTop: 8,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
  },
  retryLabel: {
    color: "#fff",
    fontSize: 14,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  date: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  subtopic: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  // Generic card
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },

  // Stats grid
  statsGrid: {
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },

  // Reflection prompts
  promptText: {
    fontSize: 14,
    color: "#bbb",
    fontStyle: "italic",
    lineHeight: 20,
  },
  promptSpacer: {
    marginTop: 8,
  },

  // Transcript
  transcriptContainer: {
    gap: 6,
  },
  transcriptSegment: {
    borderRadius: 10,
    padding: 12,
  },
  teacherSegment: {
    backgroundColor: "rgba(52,152,219,0.1)",
  },
  studentSegment: {
    backgroundColor: "rgba(46,204,113,0.07)",
  },
  transcriptMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  transcriptSpeaker: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  transcriptTime: {
    fontSize: 11,
    color: "#555",
    fontVariant: ["tabular-nums"],
  },
  transcriptText: {
    fontSize: 14,
    color: "#ddd",
    lineHeight: 20,
  },

  // Bottom padding
  bottomPad: {
    height: 16,
  },
});
