import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface LessonTimelineProps {
  talkTime: {
    teacherPercent: number;
    studentPercent: number;
    groupPercent: number;
    silencePercent: number;
    mediaPercent: number;
  };
}

const COLORS = {
  teacher: "#3498db",
  student: "#2ecc71",
  group: "#f39c12",
  silence: "#95a5a6",
  media: "#9b59b6",
};

const LEGEND_ITEMS: Array<{
  key: keyof LessonTimelineProps["talkTime"];
  label: string;
  color: string;
}> = [
  { key: "teacherPercent", label: "Teacher", color: COLORS.teacher },
  { key: "studentPercent", label: "Student", color: COLORS.student },
  { key: "groupPercent", label: "Group", color: COLORS.group },
  { key: "silencePercent", label: "Silence", color: COLORS.silence },
  { key: "mediaPercent", label: "Media", color: COLORS.media },
];

export default function LessonTimeline({ talkTime }: LessonTimelineProps) {
  const segments = [
    { flex: talkTime.teacherPercent, color: COLORS.teacher },
    { flex: talkTime.studentPercent, color: COLORS.student },
    { flex: talkTime.groupPercent, color: COLORS.group },
    { flex: talkTime.silencePercent, color: COLORS.silence },
    { flex: talkTime.mediaPercent, color: COLORS.media },
  ].filter((s) => s.flex > 0);

  return (
    <View>
      {/* Bar */}
      <View style={styles.bar}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { flex: seg.flex, backgroundColor: seg.color },
              i === 0 && styles.segmentFirst,
              i === segments.length - 1 && styles.segmentLast,
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {LEGEND_ITEMS.filter((item) => talkTime[item.key] > 0).map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>
              {item.label} {Math.round(talkTime[item.key])}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 24,
    borderRadius: 6,
    overflow: "hidden",
  },
  segment: {
    height: "100%",
  },
  segmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: "#aaa",
  },
});
