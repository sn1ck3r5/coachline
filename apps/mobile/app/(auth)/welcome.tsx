import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function Welcome() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#0a0a0a",
      }}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: "700",
          color: "#fff",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Coachline
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: "#888",
          textAlign: "center",
          marginBottom: 48,
        }}
      >
        Your private instructional coach
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor="#555"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 12,
          padding: 16,
          color: "#fff",
          fontSize: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "#333",
        }}
      />
      <Pressable
        onPress={() =>
          router.push({ pathname: "/(auth)/login", params: { email } })
        }
        style={{
          backgroundColor: "#2563eb",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          Continue with Email
        </Text>
      </Pressable>
      <Pressable
        style={{
          backgroundColor: "#4285f4",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          Continue with Google
        </Text>
      </Pressable>
    </View>
  );
}
