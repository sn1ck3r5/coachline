import { View, Text } from "react-native";

export default function VoiceEnrollment() {
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
        Voice Enrollment
      </Text>
      <Text style={{ color: "#888", fontSize: 14, marginTop: 8 }}>
        Coming soon
      </Text>
    </View>
  );
}
