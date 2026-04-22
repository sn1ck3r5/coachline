import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export interface AudioRecorderProps {
  onRecordingComplete: (
    uri: string,
    durationSeconds: number,
    fileSizeBytes: number
  ) => void;
  onError: (error: Error) => void;
}

type RecordingState = "idle" | "recording" | "uploading" | "done";

const NUM_BARS = 10;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AudioRecorder({
  onRecordingComplete,
  onError,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated values for waveform bars
  const barAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.2))
  ).current;

  // Pulse animation for the record button glow
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowLoop = useRef<Animated.CompositeAnimation | null>(null);

  const animateBars = useCallback(
    (active: boolean) => {
      if (active) {
        const animations = barAnims.map((anim) => {
          const randomHeight = 0.2 + Math.random() * 0.8;
          return Animated.sequence([
            Animated.timing(anim, {
              toValue: randomHeight,
              duration: 150 + Math.random() * 200,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.1 + Math.random() * 0.3,
              duration: 150 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ]);
        });
        Animated.loop(Animated.stagger(50, animations)).start();
      } else {
        barAnims.forEach((anim) =>
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 300,
            useNativeDriver: false,
          }).start()
        );
      }
    },
    [barAnims]
  );

  const startGlow = useCallback(() => {
    glowLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    glowLoop.current.start();
  }, [glowAnim]);

  const stopGlow = useCallback(() => {
    glowLoop.current?.stop();
    glowAnim.setValue(0);
  }, [glowAnim]);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [stopTimer]);

  const handleStartRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        onError(new Error("Microphone permission denied"));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState("recording");
      startTimer();
      animateBars(true);
      startGlow();
    } catch (err) {
      onError(err instanceof Error ? err : new Error("Failed to start recording"));
    }
  };

  const handleStopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      stopTimer();
      animateBars(false);
      stopGlow();

      const recording = recordingRef.current;
      recordingRef.current = null;

      // Get status before stopping to capture duration
      const status = await recording.getStatusAsync();
      const durationSeconds = status.isRecording
        ? Math.round((status.durationMillis ?? 0) / 1000)
        : elapsed;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error("Recording URI is null after stopping");
      }

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSizeBytes =
        fileInfo.exists && "size" in fileInfo ? (fileInfo.size ?? 0) : 0;

      setState("done");
      onRecordingComplete(uri, durationSeconds || elapsed, fileSizeBytes);
    } catch (err) {
      onError(err instanceof Error ? err : new Error("Failed to stop recording"));
    }
  };

  const isRecording = state === "recording";

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <View style={styles.container}>
      {/* Timer */}
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>

      {/* Waveform */}
      <View style={styles.waveform}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 48],
                }),
                opacity: isRecording ? 1 : 0.4,
              },
            ]}
          />
        ))}
      </View>

      {/* Background hint */}
      <Text style={styles.hint}>
        You can minimize the app. Recording continues in the background.
      </Text>

      {/* Record / Stop button */}
      <View style={styles.buttonWrapper}>
        {isRecording && (
          <Animated.View
            style={[
              styles.glow,
              { opacity: glowOpacity, shadowRadius: glowRadius },
            ]}
          />
        )}
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          activeOpacity={0.8}
          disabled={state === "uploading" || state === "done"}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <View style={styles.innerCircle} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.buttonLabel}>
        {isRecording ? "Tap to stop" : "Tap to record"}
      </Text>
    </View>
  );
}

const BUTTON_SIZE = 72;
const ACCENT = "#e74c3c";

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 24,
  },
  timer: {
    fontSize: 56,
    fontVariant: ["tabular-nums"],
    color: "#fff",
    fontWeight: "200",
    letterSpacing: 2,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 56,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  buttonWrapper: {
    width: BUTTON_SIZE + 32,
    height: BUTTON_SIZE + 32,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: BUTTON_SIZE + 32,
    height: BUTTON_SIZE + 32,
    borderRadius: (BUTTON_SIZE + 32) / 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    elevation: 12,
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
  recordButtonActive: {
    shadowOpacity: 0.7,
    shadowRadius: 16,
  },
  innerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  buttonLabel: {
    fontSize: 14,
    color: "#888",
    letterSpacing: 0.5,
  },
});
