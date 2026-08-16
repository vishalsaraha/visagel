import { Tabs } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { AuthProvider } from "@/context/AuthContext";
import { AttendanceProvider } from "@/context/AttendanceContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AttendanceProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: "#FF6900",
              borderTopWidth: 0,
              elevation: 0,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarActiveTintColor: "#FFFFFF",
            tabBarInactiveTintColor: "rgba(255, 255, 255, 0.7)",
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: "600",
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              href: null,
              tabBarStyle: { display: "none" },
            }}
          />
          <Tabs.Screen
            name="screens/enrolment"
            options={{
              title: "Enrolment",
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="user-plus" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="screens/dashboard"
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="bar-chart" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="screens/settings"
            options={{
              title: "Settings",
              tabBarIcon: ({ color, size }) => (
                <FontAwesome name="cog" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </AttendanceProvider>
    </AuthProvider>
  );
}