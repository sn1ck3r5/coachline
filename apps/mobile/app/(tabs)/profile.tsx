import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import type { User } from "@coachline/shared";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";

const GRADE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "K" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [targetGrade, setTargetGrade] = React.useState<number | null>(null);
  const [savingGrade, setSavingGrade] = React.useState(false);

  React.useEffect(() => {
    api
      .get<User>("/users/me")
      .then((u) => setTargetGrade(u.targetGrade ?? null))
      .catch(() => {});
  }, []);

  const handleGradeSelect = async (value: number | null) => {
    if (value === targetGrade) value = null; // tap again to clear
    setSavingGrade(true);
    try {
      const updated = await api.patch<User>("/users/me", { targetGrade: value });
      setTargetGrade(updated.targetGrade ?? null);
    } catch {
      Alert.alert("Error", "Failed to save grade. Please try again.");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } catch {
      Alert.alert("Error", "Sign out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your recordings, reports, and data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/users/me");
              await signOut();
            } catch {
              Alert.alert("Error", "Failed to delete account. Please try again.");
            }
          },
        },
      ]
    );
  };

  const enrolled = !!user?.voiceEnrollmentUrl;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Info ── */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(user?.name ?? "T").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? "—"}</Text>
            <Text style={styles.userEmail}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        {/* ── Voice Enrollment ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>VOICE ENROLLMENT</Text>
          <View style={styles.card}>
            <View style={styles.enrollmentRow}>
              <View style={styles.enrollmentLeft}>
                <Text style={styles.enrollmentTitle}>Voice Profile</Text>
                <Text style={styles.enrollmentSubtitle}>
                  {enrolled
                    ? "Your voice has been enrolled for speaker diarization."
                    : "Enroll your voice to improve transcription accuracy."}
                </Text>
              </View>
              {enrolled ? (
                <View style={styles.enrolledBadge}>
                  <Text style={styles.enrolledBadgeText}>✓ Enrolled</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.enrollButton}
                  onPress={() => router.push("/(auth)/voice-enrollment" as any)}
                >
                  <Text style={styles.enrollButtonText}>Enroll</Text>
                </TouchableOpacity>
              )}
            </View>
            {enrolled && (
              <TouchableOpacity
                style={styles.reEnrollButton}
                onPress={() => router.push("/(auth)/voice-enrollment" as any)}
              >
                <Text style={styles.reEnrollText}>Re-record voice sample →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Teaching Preferences ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TEACHING PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.gradeHeaderRow}>
              <Text style={styles.enrollmentTitle}>Primary grade level</Text>
              <Text style={styles.enrollmentSubtitle}>
                Used to calibrate lesson analytics (e.g. vocabulary grade level).
              </Text>
            </View>
            <View style={styles.gradeRowWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gradeRow}
              >
                {GRADE_OPTIONS.map((opt) => {
                  const selected = targetGrade === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.gradePill, selected && styles.gradePillSelected]}
                      onPress={() => handleGradeSelect(opt.value)}
                      disabled={savingGrade}
                    >
                      <Text
                        style={[
                          styles.gradePillLabel,
                          selected && styles.gradePillLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ── Account Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color="#888" />
              ) : (
                <Text style={styles.actionLabel}>Sign Out</Text>
              )}
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionRow} onPress={handleDeleteAccount}>
              <Text style={[styles.actionLabel, styles.dangerLabel]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingTop: 16,
    paddingBottom: 48,
  },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#888",
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

  // Generic card
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
  },

  // Voice enrollment
  enrollmentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  enrollmentLeft: {
    flex: 1,
  },
  enrollmentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  enrollmentSubtitle: {
    fontSize: 13,
    color: "#888",
    lineHeight: 18,
  },
  enrolledBadge: {
    backgroundColor: "#1e3d1e",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  enrolledBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2ecc71",
  },
  enrollButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  enrollButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  reEnrollButton: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  reEnrollText: {
    fontSize: 13,
    color: "#3b82f6",
  },

  // Grade picker
  gradeHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  gradeRowWrapper: {
    paddingHorizontal: 10,
    paddingBottom: 16,
  },
  gradeRow: {
    paddingHorizontal: 6,
    gap: 8,
  },
  gradePill: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  gradePillSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e2d4d",
  },
  gradePillLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
  },
  gradePillLabelSelected: {
    color: "#fff",
  },

  // Action rows
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 15,
    color: "#fff",
  },
  dangerLabel: {
    color: "#e74c3c",
  },
  actionDivider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 16,
  },
});
