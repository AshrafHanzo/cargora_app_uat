/**
 * The small pieces every screen is built from.
 *
 * They live together because they share one job: making the app look like one product
 * rather than four screens written on four days. Nothing here fetches or knows about the
 * API - these take values and draw them.
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { modeColor, radius, shadow, spacing, typography, useTheme } from "../theme";

/* ------------------------------------------------------------------ text */

export function Title({ children, style }: { children: React.ReactNode; style?: any }) {
  const t = useTheme();
  return <Text style={[typography.h1, { color: t.text }, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[typography.label, { color: t.textFaint, textTransform: "uppercase" }]}>
      {children}
    </Text>
  );
}

export function Muted({
  children, style, numberOfLines,
}: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[typography.small, { color: t.textMuted }, style]}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ containers */

export function Card({
  children, style, padded = true,
}: { children: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          padding: padded ? spacing.lg : 0,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The gradient top of every screen. The children sit over it, so a screen's filters can
 *  live in the coloured area and the white content scrolls underneath. */
export function ScreenHeader({
  title, subtitle, right, children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={t.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: radius.xxl,
        borderBottomRightRadius: radius.xxl,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h1, { color: "#FFFFFF" }]}>{title}</Text>
          {subtitle ? (
            <Text style={[typography.small, { color: "rgba(255,255,255,0.85)", marginTop: 2 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ numbers */

/** The up/down pill. Null means there was nothing to compare against, which is shown as
 *  exactly that rather than as 0% - "no data last period" and "flat" are different facts and
 *  a manager will act on them differently. */
export function ChangePill({ value, compact }: { value: number | null; compact?: boolean }) {
  const t = useTheme();
  if (value === null) {
    return (
      <View style={[styles.pill, { backgroundColor: t.cardAlt }]}>
        <Text style={[typography.small, { color: t.textMuted, fontWeight: "700" }]}>
          {compact ? "—" : "No comparison"}
        </Text>
      </View>
    );
  }
  const up = value >= 0;
  return (
    <View style={[styles.pill, { backgroundColor: up ? t.successSoft : t.dangerSoft }]}>
      <Text
        style={[
          typography.small,
          { color: up ? t.successText : t.dangerText, fontWeight: "800" },
        ]}
      >
        {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
      </Text>
    </View>
  );
}

/** The one big number on the dashboard. */
export function BigStat({
  value, caption, change,
}: { value: number; caption: string; change?: number | null }) {
  const t = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Text style={[typography.display, { color: t.text }]}>{value}</Text>
        {change !== undefined ? <ChangePill value={change ?? null} /> : null}
      </View>
      <Muted style={{ marginTop: 2 }}>{caption}</Muted>
    </View>
  );
}

/** One shipment mode's count, with its own colour down the left edge. */
export function ModeStat({
  mode, completed, change,
}: { mode: string; completed: number; change: number | null }) {
  const t = useTheme();
  const color = modeColor(mode);
  return (
    <Card style={{ flex: 1, minWidth: 150, padding: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: color }} />
        <Text numberOfLines={1} style={[typography.small, { color: t.textMuted, flex: 1 }]}>
          {mode}
        </Text>
      </View>
      <Text style={[typography.h1, { color: t.text, marginTop: spacing.sm }]}>{completed}</Text>
      <View style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}>
        <ChangePill value={change} compact />
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ chips */

export function Chip({
  label, selected, onPress, color, disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const accent = color ?? t.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // A tap target smaller than this is genuinely hard to hit on a phone in a warehouse.
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : t.card,
          borderColor: selected ? accent : t.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          typography.small,
          { color: selected ? "#FFFFFF" : t.textMuted, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The chips that sit on the coloured header, which needs its own contrast. */
export function HeaderChip({
  label, selected, onPress,
}: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.16)",
          borderColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.3)",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          typography.small,
          { color: selected ? "#4338CA" : "#FFFFFF", fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      {children}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ buttons */

export function Button({
  label, onPress, variant = "primary", loading, disabled, style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const off = disabled || loading;
  const bg =
    variant === "primary" ? t.primary : variant === "danger" ? t.dangerSoft : "transparent";
  const fg =
    variant === "primary" ? "#FFFFFF" : variant === "danger" ? t.dangerText : t.primaryText;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? t.border : "transparent",
          borderWidth: variant === "ghost" ? StyleSheet.hairlineWidth : 0,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[typography.h3, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ states */

/** Shown while the first load runs. Grey blocks the shape of the real content, rather than
 *  a spinner, so the screen does not visibly jump when the data lands. */
export function Skeleton({ height, width, style }: { height: number; width?: any; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        { height, width: width ?? "100%", borderRadius: radius.md, backgroundColor: t.skeleton },
        style,
      ]}
    />
  );
}

/** Every empty list in the app says WHY it is empty and what would fill it. "No data" on
 *  its own reads as a broken app. */
export function EmptyState({
  title, body, icon = "○",
}: { title: string; body?: string; icon?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }}>
      <View
        style={{
          width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
          backgroundColor: t.cardAlt, marginBottom: spacing.md,
        }}
      >
        <Text style={{ fontSize: 24, color: t.textFaint }}>{icon}</Text>
      </View>
      <Text style={[typography.h3, { color: t.text, textAlign: "center" }]}>{title}</Text>
      {body ? (
        <Muted style={{ textAlign: "center", marginTop: spacing.xs, maxWidth: 280 }}>{body}</Muted>
      ) : null}
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.danger, backgroundColor: t.dangerSoft }}>
      <Text style={[typography.body, { color: t.dangerText }]}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" variant="ghost" onPress={onRetry} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
});
