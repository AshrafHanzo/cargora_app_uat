/**
 * Profile - who is signed in, what this phone is set to watch, and the way out.
 *
 * It also names the environment the app is talking to. That is not a debug leftover: UAT
 * and production are two different servers with two different databases, and a manager
 * looking at a number should always be able to tell which one it came from.
 */
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_LABEL } from "../../src/api/config";
import { useAuth } from "../../src/auth/AuthContext";
import { Logo } from "../../src/components/Logo";
import { Button, Card, Muted, ScreenHeader, SectionLabel } from "../../src/components/ui";
import { modeColor, radius, spacing, typography, useTheme } from "../../src/theme";

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Muted>{label}</Muted>
      <Text numberOfLines={1} style={[typography.body, { color: t.text, flex: 1, textAlign: "right" }]}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { identity, activeModes, selectedModes, signOut, refreshIdentity } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const watchingAll = selectedModes.length === 0;

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "You will need your email and password to sign back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            // The Gate in _layout.tsx sends us to /login; nothing to do here.
          },
        },
      ],
    );
  }

  const initials =
    (identity?.full_name ?? identity?.email ?? "?")
      .split(/[\s@._]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Profile" subtitle={identity?.company_name ?? undefined} />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: t.primaryText }}>{initials}</Text>
          </View>
          <Text style={[typography.h2, { color: t.text, marginTop: spacing.md }]}>
            {identity?.full_name || "Manager"}
          </Text>
          <Muted style={{ marginTop: 2 }}>{identity?.email}</Muted>
          <View style={[styles.badge, { backgroundColor: t.successSoft, marginTop: spacing.md }]}>
            <Text style={[typography.small, { color: t.successText, fontWeight: "700" }]}>
              View only
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Watching</SectionLabel>
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {activeModes.map((m) => (
                <View
                  key={m}
                  style={[styles.badge, { backgroundColor: modeColor(m) }]}
                >
                  <Text style={[typography.small, { color: "#FFFFFF", fontWeight: "700" }]}>{m}</Text>
                </View>
              ))}
            </View>
            <Muted style={{ marginTop: spacing.md }}>
              {watchingAll
                ? "Everything this company login covers. New shipment types added later appear automatically."
                : `${activeModes.length} of ${identity?.allowed_modes.length ?? 0} shipment types.`}
            </Muted>
            <Muted style={{ marginTop: spacing.xs }}>
              Your setting on this phone only — it does not change what anyone else sees.
            </Muted>
            <Button
              label="Change what I watch"
              variant="ghost"
              onPress={() => router.push("/modes")}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Account</SectionLabel>
          <Card>
            <Row label="Company" value={identity?.company_name ?? "—"} />
            <Row label="Access" value="Manager (read only)" />
            <Row label="Allowed types" value={`${identity?.allowed_modes.length ?? 0}`} />
            {/* Which Cargora the figures came from. */}
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Muted>Connected to</Muted>
              <View style={[styles.badge, { backgroundColor: API_LABEL === "Production" ? t.dangerSoft : t.primarySoft }]}>
                <Text
                  style={[
                    typography.small,
                    { color: API_LABEL === "Production" ? t.dangerText : t.primaryText, fontWeight: "700" },
                  ]}
                >
                  {API_LABEL}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <Pressable onPress={() => void refreshIdentity()} hitSlop={8}>
          <Muted style={{ textAlign: "center" }}>
            Tap to re-check what this login is allowed to see
          </Muted>
        </Pressable>

        <Button
          label="Sign out"
          variant="danger"
          onPress={confirmSignOut}
          loading={signingOut}
        />

        <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
          <Logo size={34} />
          <Muted>Cargora Manager · v1.0.0</Muted>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
