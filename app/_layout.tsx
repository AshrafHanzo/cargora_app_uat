/**
 * The app's shell, and the one place that decides which screen a launch lands on.
 *
 * Three states, checked in order, because each one depends on the one before:
 *   not signed in            -> /login
 *   signed in, no modes yet  -> /modes   (the first-run picker)
 *   signed in, modes chosen  -> the tabs
 *
 * Doing this here rather than in each screen means there is exactly one redirect rule to
 * reason about. Screens never guard themselves.
 */
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { useTheme } from "../src/theme";

function Gate() {
  const { status, hasChosenModes, identity } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    if (status === "loading") return;

    const group = segments[0];
    const onLogin = group === "login";
    const onModes = group === "modes";

    if (status === "signedOut") {
      if (!onLogin) router.replace("/login");
      return;
    }

    // A login with exactly one allowed mode has nothing to choose, so the picker is skipped
    // rather than shown with a single option and an OK button.
    const mustChoose =
      !hasChosenModes && (identity?.allowed_modes.length ?? 0) > 1;

    if (mustChoose) {
      if (!onModes) router.replace("/modes");
      return;
    }
    if (onLogin || onModes) router.replace("/");
  }, [status, hasChosenModes, identity, segments, router]);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="modes" options={{ presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* The header is a deep gradient in both themes, so the status bar is always light. */}
          <StatusBar style="light" />
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
