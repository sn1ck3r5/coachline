import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

interface HighlightCardProps {
  title: string;
  description: string;
  startMs: number;
  onPlay: (startMs: number) => void;
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function HighlightCard({
  title,
  description,
  startMs,
  onPlay,
}: HighlightCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.leftBorder} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => onPlay(startMs)}
          activeOpacity={0.75}
        >
          <Text style={styles.playIcon}>▶</Text>
          <Text style={styles.playLabel}>Play at {formatTimestamp(startMs)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ACCENT = "#2ecc71";

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(46,204,113,0.1)",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },
  leftBorder: {
    width: 4,
    backgroundColor: ACCENT,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  description: {
    fontSize: 13,
    color: "#bbb",
    lineHeight: 18,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playIcon: {
    fontSize: 10,
    color: "#000",
  },
  playLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
});
