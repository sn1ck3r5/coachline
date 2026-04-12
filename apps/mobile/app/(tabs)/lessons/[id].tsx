import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function LessonReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
        Lesson Report
      </Text>
      <Text style={{ color: "#888", fontSize: 14, marginTop: 8 }}>
        ID: {id}
      </Text>
    </View>
  );
}
