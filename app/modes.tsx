/**
 * "Which shipments do you want to watch?"
 *
 * Shown once after the first sign-in, and reachable afterwards from Profile. Multi-select:
 * one phone can watch Air Import and Sea Import together.
 *
 * It offers ONLY what this login is allowed (identity.allowed_modes, set by a Super Admin).
 * Choosing here narrows that; it can never widen it, and the server intersects the choice
 * again on every request, so this screen is a convenience rather than a security boundary.
 */
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/AuthContext";
import { Button, Card, Muted, ScreenHeader } from "../src/components/ui";
import { modeColor, modeInitials, radius, spacing, typography, useTheme } from "../src/theme";

export default function ModesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { identity, selectedModes, setModes, hasChosenModes } = useAuth();

  const allowed = identity?.allowed_modes ?? [];
  const [picked, setPicked] = useState<string[]>(
    // Opening the picker again shows what is currently in force; the first run starts with
    // everything ticked, since "show me all of it" is the common answer and un-ticking is
    // less work than ticking four boxes.
    selectedModes.length ? selectedModes : allowed,
  );
  const [saving, setSaving] = useState(false);

  const allSelected = picked.length === allowed.length && allowed.length > 0;

  function toggle(mode: string) {
    setPicked((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    );
  }

  async function save() {
    if (picked.length === 0) return;
    setSaving(true);
    // Every mode ticked is stored as the empty list, meaning "whatever I am allowed". That
    // way a login later granted a fifth mode sees it immediately, instead of being pinned
    // to the four that happened to exist on the day the choice was made.
    await setModes(allSelected ? [] : picked);
    setSaving(false);
    router.replace("/");
  }

  const subtitle = useMemo(
    () =>
      hasChosenModes
        ? "Change what this phone shows"
        : identity?.company_name
          ? `Signed in to ${identity.company_name}`
          : "Choose what this phone shows",
    [hasChosenModes, identity],
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="What do you watch?" subtitle={subtitle} />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl + 60,
          gap: spacing.md,
        }}
      >
        <Muted>
          Pick one or more shipment types. Only these will appear on your dashboard, usage
          and reports. You can change this any time from Profile.
        </Muted>

        {allowed.length > 1 ? (
          <Pressable onPress={() => setPicked(allSelected ? [] : allowed)} hitSlop={6}>
            <Text style={[typography.small, { color: t.primaryText, fontWeight: "700" }]}>
              {allSelected ? "Clear all" : "Select all"}
            </Text>
          </Pressable>
        ) : null}

        {allowed.map((mode) => {
          const on = picked.includes(mode);
          const color = modeColor(mode);
          return (
            <Pressable key={mode} onPress={() => toggle(mode)}>
              {({ pressed }) => (
                <Card
                  style={{
                    borderColor: on ? color : t.border,
                    borderWidth: on ? 2 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: radius.md,
                      backgroundColor: on ? color : t.cardAlt,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: on ? "#FFFFFF" : t.textMuted }}>
                      {modeInitials(mode)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[typography.h3, { color: t.text }]}>{mode}</Text>
                  </View>

                  {/* A tick box rather than a switch: this is a multi-select list, and a row
                      of switches reads as four independent settings. */}
                  <View
                    style={{
                      width: 24, height: 24, borderRadius: 7,
                      borderWidth: 2, borderColor: on ? color : t.borderStrong,
                      backgroundColor: on ? color : "transparent",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {on ? <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>✓</Text> : null}
                  </View>
                </Card>
              )}
            </Pressable>
          );
        })}

        {allowed.length === 0 ? (
          <Card>
            <Text style={[typography.h3, { color: t.text }]}>No shipment types yet</Text>
            <Muted style={{ marginTop: spacing.xs }}>
              This login has not been given any shipment types to watch. Ask your Cargora
              administrator to set them, then sign in again.
            </Muted>
          </Card>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg,
          backgroundColor: t.bgElevated,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
        }}
      >
        <Button
          label={picked.length === 0 ? "Pick at least one" : `Show ${picked.length === allowed.length ? "everything" : `${picked.length} selected`}`}
          onPress={save}
          loading={saving}
          disabled={picked.length === 0}
        />
      </View>
    </View>
  );
}
