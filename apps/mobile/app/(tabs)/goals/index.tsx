import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import type { Goal } from "@coachline/shared";
import { api } from "../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PracticeArea = "wait_time" | "open_questions" | "student_talk_ratio" | "uptake" | "custom";

interface PracticeCard {
  area: PracticeArea;
  label: string;
  description: string;
}

const PRACTICE_CARDS: PracticeCard[] = [
  {
    area: "wait_time",
    label: "Increase think time",
    description: "Give students more time to process before responding",
  },
  {
    area: "open_questions",
    label: "Ask more open-ended questions",
    description: "Encourage richer student thinking with open Qs",
  },
  {
    area: "student_talk_ratio",
    label: "Increase student talk ratio",
    description: "Shift the balance from teacher to student talk",
  },
  {
    area: "uptake",
    label: "Build on student ideas",
    description: "Use student contributions to advance discussion",
  },
  {
    area: "custom",
    label: "Custom goal",
    description: "Define your own practice focus",
  },
];

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

// ─── Goal Row ─────────────────────────────────────────────────────────────────

interface GoalRowProps {
  goal: Goal;
  onPress: () => void;
}

function GoalRow({ goal, onPress }: GoalRowProps) {
  const color = statusColor(goal.status);
  const label = practiceAreaLabel(goal.practiceArea, goal.customLabel);

  return (
    <TouchableOpacity style={styles.goalRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.goalRowLeft}>
        <Text style={styles.goalRowTitle} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.goalRowTarget}>Target: {goal.targetMetric}</Text>
      </View>
      <View style={[styles.statusBadge, { borderColor: color }]}>
        <Text style={[styles.statusBadgeText, { color }]}>{statusLabel(goal.status)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Create Goal Modal ────────────────────────────────────────────────────────

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateGoalModal({ visible, onClose, onCreated }: CreateGoalModalProps) {
  const [selectedArea, setSelectedArea] = useState<PracticeArea | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSelectedArea(null);
    setCustomLabel("");
    setTargetMetric("");
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!selectedArea) {
      Alert.alert("Select a practice area", "Please choose what you want to work on.");
      return;
    }
    if (!targetMetric.trim()) {
      Alert.alert("Add a target", "Please describe your target metric.");
      return;
    }
    if (selectedArea === "custom" && !customLabel.trim()) {
      Alert.alert("Name your goal", "Please enter a label for your custom goal.");
      return;
    }

    try {
      setSaving(true);
      await api.post("/goals", {
        practiceArea: selectedArea,
        targetMetric: targetMetric.trim(),
        ...(selectedArea === "custom" ? { customLabel: customLabel.trim() } : {}),
      });
      reset();
      onCreated();
    } catch {
      Alert.alert("Error", "Failed to save goal. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Set a Goal</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalSectionLabel}>PRACTICE AREA</Text>

            {PRACTICE_CARDS.map((card) => {
              const isSelected = selectedArea === card.area;
              return (
                <TouchableOpacity
                  key={card.area}
                  style={[styles.practiceCard, isSelected && styles.practiceCardSelected]}
                  onPress={() => setSelectedArea(card.area)}
                  activeOpacity={0.7}
                >
                  <View style={styles.practiceCardContent}>
                    <View style={[styles.practiceCardRadio, isSelected && styles.practiceCardRadioSelected]}>
                      {isSelected && <View style={styles.practiceCardRadioDot} />}
                    </View>
                    <View style={styles.practiceCardText}>
                      <Text style={[styles.practiceCardTitle, isSelected && styles.practiceCardTitleSelected]}>
                        {card.label}
                      </Text>
                      <Text style={styles.practiceCardDesc}>{card.description}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {selectedArea === "custom" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>GOAL LABEL</Text>
                <TextInput
                  style={styles.textInput}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="e.g. Reduce teacher talk to under 50%"
                  placeholderTextColor="#444"
                  autoCapitalize="sentences"
                  maxLength={120}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TARGET METRIC</Text>
              <TextInput
                style={styles.textInput}
                value={targetMetric}
                onChangeText={setTargetMetric}
                placeholder={
                  selectedArea === "wait_time"
                    ? "e.g. 3+ seconds avg wait time"
                    : selectedArea === "student_talk_ratio"
                    ? "e.g. 40% student talk"
                    : selectedArea === "open_questions"
                    ? "e.g. 5 open questions per lesson"
                    : "e.g. Describe your target"
                }
                placeholderTextColor="#444"
                autoCapitalize="sentences"
                maxLength={160}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Goal[]>("/goals");
      setGoals(data);
    } catch {
      Alert.alert("Error", "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleGoalCreated = () => {
    setModalVisible(false);
    loadGoals();
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Goals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Set a Goal</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : goals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySubtitle}>
            Set a practice goal to track your progress over time.
          </Text>
          <TouchableOpacity
            style={styles.setGoalButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.setGoalButtonText}>Set Your First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {goals.map((goal, i) => (
              <React.Fragment key={goal.id}>
                {i > 0 && <View style={styles.divider} />}
                <GoalRow
                  goal={goal}
                  onPress={() => router.push(`/(tabs)/goals/${goal.id}` as any)}
                />
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}

      <CreateGoalModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={handleGoalCreated}
      />
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
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  addButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Empty state
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  setGoalButton: {
    marginTop: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  setGoalButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Goal list
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  goalRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  goalRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  goalRowTarget: {
    fontSize: 13,
    color: "#888",
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
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 16,
  },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  modalCancel: {
    fontSize: 16,
    color: "#888",
  },
  modalSave: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3b82f6",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
  },
  modalSectionLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Practice cards
  practiceCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  practiceCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#0d1f3a",
  },
  practiceCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  practiceCardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  practiceCardRadioSelected: {
    borderColor: "#3b82f6",
  },
  practiceCardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3b82f6",
  },
  practiceCardText: {
    flex: 1,
  },
  practiceCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#aaa",
    marginBottom: 2,
  },
  practiceCardTitleSelected: {
    color: "#fff",
  },
  practiceCardDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },

  // Inputs
  inputGroup: {
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
});
