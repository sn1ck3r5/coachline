import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";

interface AudioPlayerProps {
  audioUrl: string | null;
  seekToMs?: number;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioUrl, seekToMs }: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis ?? 0);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }, []);

  // Load sound when audioUrl changes
  useEffect(() => {
    if (!audioUrl) return;

    let mounted = true;

    const load = async () => {
      try {
        // Unload previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound: s } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        if (!mounted) {
          s.unloadAsync();
          return;
        }

        soundRef.current = s;
        setSound(s);
        setPositionMs(0);
        setIsPlaying(false);
      } catch {
        // Audio load failure is non-fatal — player just won't function
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [audioUrl, onPlaybackStatusUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Seek when seekToMs changes
  useEffect(() => {
    if (soundRef.current && seekToMs !== undefined) {
      const seek = async () => {
        try {
          await soundRef.current?.setPositionAsync(seekToMs);
          await soundRef.current?.playAsync();
          setIsPlaying(true);
        } catch {
          // Seek failure is non-fatal
        }
      };
      seek();
    }
  }, [seekToMs]);

  const handlePlayPause = async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch {
      // Play/pause failure is non-fatal
    }
  };

  const handleBarPress = async (event: GestureResponderEvent) => {
    if (!soundRef.current || durationMs === 0 || barWidth === 0) return;
    const { locationX } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    const targetMs = Math.floor(ratio * durationMs);
    try {
      await soundRef.current.setPositionAsync(targetMs);
    } catch {
      // Seek failure is non-fatal
    }
  };

  const onBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  if (!audioUrl) return null;

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <TouchableOpacity
        style={styles.playPauseButton}
        onPress={handlePlayPause}
        activeOpacity={0.75}
      >
        <Text style={styles.playPauseIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      {/* Progress bar and timestamps */}
      <View style={styles.progressArea}>
        <Pressable
          style={styles.progressBarTrack}
          onPress={handleBarPress}
          onLayout={onBarLayout}
        >
          <View
            style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
          />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatMs(positionMs)}</Text>
          <Text style={styles.timeText}>{formatMs(durationMs)}</Text>
        </View>
      </View>
    </View>
  );
}

const ACCENT = "#2ecc71";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  playPauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseIcon: {
    fontSize: 16,
    color: "#000",
  },
  progressArea: {
    flex: 1,
    gap: 4,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 11,
    color: "#888",
    fontVariant: ["tabular-nums"],
  },
});
