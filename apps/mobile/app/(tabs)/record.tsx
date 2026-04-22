import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import AudioRecorder from "../../components/AudioRecorder";
import { api } from "../../lib/api";

type ScreenState = "recording" | "review" | "saving";

interface CompletedRecording {
  uri: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

interface UploadUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

export default function RecordScreen() {
  const router = useRouter();
  const [screenState, setScreenState] = useState<ScreenState>("recording");
  const [completed, setCompleted] = useState<CompletedRecording | null>(null);
  const [title, setTitle] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRecordingComplete = (
    uri: string,
    durationSeconds: number,
    fileSizeBytes: number
  ) => {
    setCompleted({ uri, durationSeconds, fileSizeBytes });
    setScreenState("review");
  };

  const handleRecordingError = (error: Error) => {
    Alert.alert("Recording Error", error.message);
  };

  const handleSave = async () => {
    if (!completed) return;

    setErrorMessage(null);
    setScreenState("saving");

    try {
      // Step 1: Get presigned upload URL
      setUploadProgress("Preparing upload...");
      const { url: presignedUrl, key } =
        await api.post<UploadUrlResponse>("/recordings/upload-url", {
          contentType: "audio/x-m4a",
          fileName: "lesson.m4a",
        });

      // Step 2: Upload file to S3 using expo-file-system
      setUploadProgress("Uploading audio...");
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, completed.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": "audio/x-m4a" },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`S3 upload failed with status ${uploadResult.status}`);
      }

      // Step 3: Create the recording record in our API
      setUploadProgress("Saving recording...");
      await api.post("/recordings", {
        audioUrl: key,
        durationSeconds: completed.durationSeconds,
        fileSizeBytes: completed.fileSizeBytes,
        ...(title.trim() ? { title: title.trim() } : {}),
      });

      // Step 4: Navigate to lessons list
      setUploadProgress(null);
      router.replace("/(tabs)/lessons");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setErrorMessage(message);
      setUploadProgress(null);
      setScreenState("review");
    }
  };

  const handleDiscard = () => {
    setCompleted(null);
    setTitle("");
    setErrorMessage(null);
    setScreenState("recording");
  };

  if (screenState === "recording") {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Recording</Text>
          <Text style={styles.headerSubtitle}>
            Capture your classroom audio
          </Text>
        </View>
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onError={handleRecordingError}
        />
      </View>
    );
  }

  if (screenState === "saving") {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#2ecc71" />
        <Text style={styles.savingText}>{uploadProgress ?? "Saving..."}</Text>
      </View>
    );
  }

  // Review state
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.reviewContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Save Recording</Text>
        <Text style={styles.headerSubtitle}>Add a title (optional)</Text>
      </View>

      {/* Recording summary card */}
      {completed && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>
              {formatDuration(completed.durationSeconds)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Size</Text>
            <Text style={styles.summaryValue}>
              {formatSize(completed.fileSizeBytes)}
            </Text>
          </View>
        </View>
      )}

      {/* Title input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Monday Math Lesson"
          placeholderTextColor="#444"
          autoCapitalize="sentences"
          returnKeyType="done"
          maxLength={120}
        />
      </View>

      {/* Error */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Recording</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
        <Text style={styles.discardButtonText}>Discard & Record Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "Unknown";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  reviewContent: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#888",
  },
  savingText: {
    fontSize: 16,
    color: "#888",
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#888",
  },
  summaryValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 24,
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
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
  saveButton: {
    backgroundColor: "#2ecc71",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  discardButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  discardButtonText: {
    fontSize: 15,
    color: "#888",
  },
});
