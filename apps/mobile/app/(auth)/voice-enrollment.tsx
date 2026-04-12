import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENROLLMENT_DURATION_SECONDS = 30;

const PASSAGE = `Plants are remarkable living organisms that convert sunlight into energy through a process called photosynthesis. Inside the chloroplasts of plant cells, chlorophyll absorbs light and uses it to transform carbon dioxide and water into glucose and oxygen. This process not only feeds the plant itself but also produces the oxygen that animals and humans depend on for survival. Without photosynthesis, life on Earth as we know it would not be possible.`;

// ─── Upload URL response ──────────────────────────────────────────────────────

interface UploadUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type FlowState = "instructions" | "recording" | "uploading" | "done";

export default function VoiceEnrollmentScreen() {
  const router = useRouter();
  const { checkAuth } = useAuth();

  const [flowState, setFlowState] = useState<FlowState>("instructions");
  const [countdown, setCountdown] = useState(ENROLLMENT_DURATION_SECONDS);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStartRecording = async () => {
    setError(null);
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Microphone access is needed for voice enrollment.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setFlowState("recording");
      setCountdown(ENROLLMENT_DURATION_SECONDS);

      // Start countdown
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Auto-stop when timer reaches 0
            handleStopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
    }
  };

  const handleStopRecording = useCallback(async () => {
    stopTimer();

    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    try {
      setFlowState("uploading");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("Recording URI is null");

      // Get presigned URL
      const { url: presignedUrl, key } = await api.post<UploadUrlResponse>(
        "/voice-enrollment/upload-url",
        { contentType: "audio/x-m4a", fileName: "enrollment.m4a" }
      );

      // Upload to S3
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": "audio/x-m4a" },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      // Register enrollment
      await api.post("/voice-enrollment", { voiceEnrollmentUrl: key });

      // Refresh auth so voiceEnrollmentUrl is set → layout redirect fires
      await checkAuth();

      setFlowState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed. Please try again.");
      setFlowState("instructions");
    }
  }, [stopTimer, checkAuth]);

  // Done state → navigate to tabs
  useEffect(() => {
    if (flowState === "done") {
      router.replace("/(tabs)");
    }
  }, [flowState, router]);

  const formatCountdown = (s: number) => `${s}s`;

  // ── Uploading state ──────────────────────────────────────────────────────────
  if (flowState === "uploading") {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.uploadingText}>Saving your voice profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Teach us your voice</Text>
          <Text style={styles.subtitle}>
            We use a short voice sample to distinguish your voice from your students' during
            transcription. Read the passage below aloud for 30 seconds.
          </Text>
        </View>

        {/* ── Passage ── */}
        <View style={styles.passageCard}>
          <Text style={styles.passageLabel}>READ ALOUD</Text>
          <Text style={styles.passageText}>{PASSAGE}</Text>
        </View>

        {/* ── Error ── */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Recording UI ── */}
        {flowState === "recording" ? (
          <View style={styles.recordingSection}>
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownValue}>{formatCountdown(countdown)}</Text>
              <Text style={styles.countdownLabel}>remaining</Text>
            </View>

            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStopRecording}
              activeOpacity={0.8}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Tap to stop early</Text>
          </View>
        ) : (
          <View style={styles.recordingSection}>
            <Text style={styles.instructionText}>
              Tap the button below and begin reading the passage.
            </Text>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={handleStartRecording}
              activeOpacity={0.8}
            >
              <View style={styles.recordButtonInner} />
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Tap to start recording</Text>
          </View>
        )}

        {/* ── Skip for now ── */}
        {flowState === "instructions" && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BUTTON_SIZE = 72;
const ACCENT = "#e74c3c";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  uploadingText: {
    fontSize: 16,
    color: "#888",
    marginTop: 8,
  },

  // Header
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    lineHeight: 22,
  },

  // Passage
  passageCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  passageLabel: {
    fontSize: 11,
    color: "#3b82f6",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  passageText: {
    fontSize: 15,
    color: "#ccc",
    lineHeight: 24,
  },

  // Error
  errorBox: {
    backgroundColor: "#2a0a0a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e74c3c44",
  },
  errorText: {
    fontSize: 14,
    color: "#e74c3c",
  },

  // Recording section
  recordingSection: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  countdownValue: {
    fontSize: 56,
    fontWeight: "200",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  countdownLabel: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  instructionText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  recordButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  stopButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  buttonLabel: {
    fontSize: 13,
    color: "#888",
    letterSpacing: 0.5,
  },

  // Skip
  skipButton: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: "#555",
  },
});
