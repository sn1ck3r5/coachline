import { View, Text } from "react-native";

export default function GoalsScreen() {
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
        Goals
      </Text>
    </View>
  );
}
