import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  async function handleSubmit() {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && !name) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle = {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    color: "#fff" as const,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
  };

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
          fontSize: 24,
          fontWeight: "700",
          color: "#fff",
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        {mode === "signin" ? "Sign In" : "Create Account"}
      </Text>

      {mode === "signup" && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor="#555"
          style={inputStyle}
        />
      )}

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor="#555"
        autoCapitalize="none"
        keyboardType="email-address"
        style={inputStyle}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#555"
        secureTextEntry
        style={inputStyle}
      />

      {error ? (
        <Text
          style={{
            color: "#ef4444",
            marginBottom: 12,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={{
          backgroundColor: "#2563eb",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
          marginBottom: 12,
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        style={{ alignItems: "center", padding: 8 }}
      >
        <Text style={{ color: "#888", fontSize: 14 }}>
          {mode === "signin"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}
