import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#222" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#666",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="lessons" options={{ title: "Lessons" }} />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
      <Tabs.Screen name="goals" options={{ title: "Goals" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
