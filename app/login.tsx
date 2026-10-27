/**
 * Sign in.
 *
 * One login per company, issued from Super Admin, and a company may hold several - one for
 * Sea Import, another for Air Import. Which modes a login may see is decided there, not
 * here; this screen only proves who is holding the phone.
 */
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_LABEL } from "../src/api/config";
import { useAuth } from "../src/auth/AuthContext";
import { Logo } from "../src/components/Logo";
import { Button } from "../src/components/ui";
import { radius, shadow, spacing, typography, useTheme } from "../src/theme";

export default function LoginScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // No navigation here on purpose - the Gate in _layout.tsx owns every redirect, so
      // there is one rule rather than two that can disagree.
    } catch (e) {
      setError((e as Error).message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient
      colors={t.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.xl,
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
            <Logo size={76} />
            <Text style={[typography.h1, { color: "#FFFFFF", marginTop: spacing.lg }]}>
              Cargora Manager
            </Text>
            <Text style={[typography.small, { color: "rgba(255,255,255,0.8)", marginTop: 4 }]}>
              Your operation, at a glance
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: t.card }, shadow.raised]}>
            <Text style={[typography.h2, { color: t.text }]}>Sign in</Text>
            <Text style={[typography.small, { color: t.textMuted, marginTop: 4 }]}>
              Use the manager login issued for your company.
            </Text>

            <Text style={[typography.label, styles.label, { color: t.textFaint }]}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="manager@company.com"
              placeholderTextColor={t.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="next"
              style={[styles.input, { color: t.text, backgroundColor: t.cardAlt, borderColor: t.border }]}
            />

            <Text style={[typography.label, styles.label, { color: t.textFaint }]}>PASSWORD</Text>
            <View style={{ position: "relative", justifyContent: "center" }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={t.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                style={[
                  styles.input,
                  { color: t.text, backgroundColor: t.cardAlt, borderColor: t.border, paddingRight: 68 },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={{ position: "absolute", right: spacing.md }}
              >
                <Text style={[typography.small, { color: t.primaryText, fontWeight: "700" }]}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={[styles.error, { backgroundColor: t.dangerSoft }]}>
                <Text style={[typography.small, { color: t.dangerText }]}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Sign in"
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
              style={{ marginTop: spacing.xl }}
            />
          </View>

          {/* Which Cargora this build talks to. Always visible, so nobody has to wonder
              whether the numbers in front of them are test data or real filings. */}
          <Text style={[typography.small, styles.env]}>Connected to {API_LABEL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xxl, padding: spacing.xl },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 16,
    minHeight: 50,
  },
  error: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md },
  env: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: spacing.xl,
    fontWeight: "600",
  },
});
