import { Tabs } from "expo-router";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider } from "@/context/AuthContext";
import { AttendanceProvider } from "@/context/AttendanceContext";
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
      {/* Background decorative circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Glowing ring around logo */}
      <Animated.View style={[styles.logoGlowRing, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Animated.View style={[styles.logoInnerRing, { opacity: logoOpacity }]}>
          <Image
            source={require("../assets/images/visagel.png")}
            style={styles.splashLogo}
            resizeMode="cover"
          />
        </Animated.View>
      </Animated.View>

      {/* App name */}
      <Animated.View style={[styles.appNameRow, { opacity: textOpacity }]}>
        <Text style={styles.splashAppName}>Visagel</Text>
        <Animated.View style={[styles.liveDot, { opacity: dotAnim }]} />
      </Animated.View>

      {/* Subtitle */}
      <Animated.Text style={[styles.splashSubtitle, { opacity: textOpacity }]}>
        Smart Facial Recognition
      </Animated.Text>

      {/* Divider */}
      <Animated.View style={[styles.splashDivider, { opacity: tagOpacity }]} />

      {/* Powered by */}
      <Animated.View style={[styles.poweredByRow, { opacity: tagOpacity }]}>
        <MaterialCommunityIcons name="lightning-bolt" size={12} color="#FF6900" style={{ marginRight: 4 }} />
        <Text style={styles.poweredByText}>Powered by </Text>
        <Text style={styles.poweredByBrand}>Branzept</Text>
      </Animated.View>

      {/* Version */}
      <Animated.Text style={[styles.splashVersion, { opacity: tagOpacity }]}>
        v1.0.0
      </Animated.Text>
    </Animated.View>
  );
}

// ── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

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

        {/* Animated splash overlay — on top of everything */}
        {!splashDone && <SplashOverlay onFinish={() => setSplashDone(true)} />}
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
  // Decorative bg circles
  bgCircle1: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(255, 105, 0, 0.04)",
    top: -80,
    right: -100,
  },
  bgCircle2: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    bottom: 80,
    left: -80,
  },
  bgCircle3: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(255, 105, 0, 0.12)",
    top: "30%",
  },
  // Logo glow ring
  logoGlowRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 105, 0, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 105, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: "#FF6900",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  logoInnerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#0D1F3C",
    borderWidth: 2,
    borderColor: "rgba(255, 105, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashLogo: {
    width: 112,
    height: 112,
  },
  // App name row
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  splashAppName: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6900",
    marginTop: 2,
    shadowColor: "#FF6900",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  splashSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 32,
  },
  splashDivider: {
    width: 48,
    height: 2,
    backgroundColor: "#FF6900",
    borderRadius: 1,
    marginBottom: 16,
    opacity: 0.6,
  },
  poweredByRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  poweredByText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  poweredByBrand: {
    fontSize: 12,
    color: "#FF6900",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  splashVersion: {
    fontSize: 10,
    color: "#334155",
    fontWeight: "600",
    marginTop: 6,
    letterSpacing: 0.5,
  },
});