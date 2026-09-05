import { Tabs } from "expo-router";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider } from "@/context/AuthContext";
import { AttendanceProvider } from "@/context/AttendanceContext";
import { ThemedAlertProvider } from "@/components/ThemedAlertProvider";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ── In-app animated splash overlay ──────────────────────────────────────────
function SplashOverlay({ onFinish }: { onFinish: () => void }) {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Dot pulse loop
    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    dotLoop.start();

    // Sequence: logo in → text in → tagline in → hold → fade out
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      Animated.timing(tagOpacity, { toValue: 1, duration: 350, delay: 50, useNativeDriver: true }),
      Animated.delay(950),
      Animated.timing(containerOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(() => {
      dotLoop.stop();
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: containerOpacity }]}>
      {/* Background decorative ambient glow */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Main Content Card / Center Stack */}
      <View style={styles.splashContentCenter}>
        {/* Glowing ring around logo */}
        <Animated.View style={[styles.logoGlowRing, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoInnerRing}>
            <Image
              source={require("../assets/images/visagel.png")}
              style={styles.splashLogo}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        {/* App name */}
        <Animated.View style={[styles.appNameRow, { opacity: textOpacity }]}>
          <Text style={styles.splashAppName}>Visagel</Text>
          <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />
        </Animated.View>

        {/* Subtitle / Tagline */}
        <Animated.Text style={[styles.splashSubtitle, { opacity: textOpacity }]}>
          Smart Facial Attendance System
        </Animated.Text>

        {/* Elegant Accent Line */}
        <Animated.View style={[styles.splashDivider, { opacity: tagOpacity }]} />
      </View>

      {/* Footer Branding & Version */}
      <Animated.View style={[styles.splashFooter, { opacity: tagOpacity }]}>
        <View style={styles.poweredByRow}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color="#FF6900" style={{ marginRight: 5 }} />
          <Text style={styles.poweredByText}>Powered by </Text>
          <Text style={styles.poweredByBrand}>Branzept</Text>
        </View>
        <Text style={styles.splashVersion}>Version 1.0.0</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <AuthProvider>
      <AttendanceProvider>
        <ThemedAlertProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: "#FF6900",
                borderTopWidth: 0,
                elevation: 0,
                height: 60,
              },
              tabBarItemStyle: {
                justifyContent: "center",
                paddingVertical: 5,
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
                  <FontAwesome name="dashboard" size={size} color={color} />
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

          {/* Animated splash overlay — on top of everything */}
          {!splashDone && <SplashOverlay onFinish={() => setSplashDone(true)} />}
        </ThemedAlertProvider>
      </AttendanceProvider>
    </AuthProvider>
  );
}

// ── Splash Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#060F1E",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  // Decorative bg circles / ambient light
  bgCircle1: {
    position: "absolute",
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: "rgba(255, 105, 0, 0.05)",
    top: -90,
    right: -110,
  },
  bgCircle2: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(14, 165, 233, 0.05)",
    bottom: -60,
    left: -70,
  },
  bgCircle3: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 105, 0, 0.1)",
  },
  splashContentCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  // Logo glow ring
  logoGlowRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 105, 0, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(255, 105, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#FF6900",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  logoInnerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FF6900",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  // App name row
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    gap: 8,
  },
  splashAppName: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#FF6900",
    marginTop: 2,
    shadowColor: "#FF6900",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  splashSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 20,
    textAlign: "center",
  },
  splashDivider: {
    width: 44,
    height: 3,
    backgroundColor: "#FF6900",
    borderRadius: 2,
    opacity: 0.8,
  },
  // Footer
  splashFooter: {
    position: "absolute",
    bottom: 36,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  poweredByRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  poweredByText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  poweredByBrand: {
    fontSize: 12,
    color: "#FF6900",
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  splashVersion: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});