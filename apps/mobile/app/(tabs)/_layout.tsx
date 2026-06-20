import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { COLORS } from "../../lib/theme";

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bgCard, shadowColor: "transparent" },
        headerTintColor: COLORS.textPrimary,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: COLORS.border,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Puzzle",
          tabBarIcon: ({ color }) => <TabIcon label="🧩" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: "Ligues",
          tabBarIcon: ({ color }) => <TabIcon label="🏆" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <TabIcon label="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
