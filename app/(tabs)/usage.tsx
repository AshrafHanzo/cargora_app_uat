/**
 * Usage - who completed what, over a period.
 *
 * Today / This month / Last 7 / Last 30, plus the mode filter. The comparison shown is
 * against the SAME LENGTH period immediately before, not "last month": comparing three days
 * against thirty-one produces a percentage that is simply wrong, and it is exactly the kind
 * that gets repeated in a meeting.
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localDateKey, managerApi } from "../../src/api/manager";
import { useAuth } from "../../src/auth/AuthContext";
import { ShareBar } from "../../src/components/TrendChart";
import {
  BigStat, Button, Card, ChangePill, Chip, ChipRow, EmptyState, ErrorNotice, Muted,
  ScreenHeader, SectionLabel, Skeleton,
} from "../../src/components/ui";
import { useAsync } from "../../src/hooks/useAsync";
import { modeColor, spacing, typography, useTheme } from "../../src/theme";

type Period = { key: string; label: string; range: () => { start: string; end: string } };

const today = () => new Date();

const PERIODS: Period[] = [
  {
    key: "today",
    label: "Today",
    range: () => ({ start: localDateKey(today()), end: localDateKey(today()) }),
  },
  {
    key: "week",
    label: "Last 7 days",
    range: () => {
      const end = today();
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return { start: localDateKey(start), end: localDateKey(end) };
    },
  },
  {
    key: "month",
    label: "This month",
    range: () => {
      const end = today();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { start: localDateKey(start), end: localDateKey(end) };
    },
  },
  {
    key: "30",
    label: "Last 30 days",
    range: () => {
      const end = today();
      const start = new Date(end);
      start.setDate(end.getDate() - 29);
      return { start: localDateKey(start), end: localDateKey(end) };
    },
  },
];

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    day: "numeric", month: "short",
  });
}

export default function UsageScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { identity, activeModes } = useAuth();

  const [periodKey, setPeriodKey] = useState("month");
  // Starts as null meaning "whatever the login may see". A tick here narrows this screen
  // only, leaving the phone's saved preference alone - it is a look, not a setting.
  const [modeFilter, setModeFilter] = useState<string[] | null>(null);

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[2];
  const { start, end } = useMemo(() => period.range(), [period]);

  const modes = modeFilter ?? activeModes;
  const modeKey = modes.join(",");

  const usage = useAsync(
    (signal) => managerApi.usage(start, end, modes, signal),
    [start, end, modeKey],
  );
  const data = usage.data;

  function toggleMode(mode: string) {
    const current = modeFilter ?? activeModes;
    const next = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    // Emptying the filter means "all of them" again rather than "none" - a screen showing
    // zero because every box was unticked reads as a broken app.
    setModeFilter(next.length === 0 ? null : next);
  }

  async function exportReport() {
    if (!data) return;
    // Share rather than a file: the phone's own sheet covers WhatsApp, mail and Slack, and
    // a manager forwarding a number to their team is what "export" actually means here.
    const lines = [
      `${identity?.company_name ?? "Cargora"} — completed jobs`,
      `${pretty(data.start)} to ${pretty(data.end)}`,
      `Shipment types: ${data.modes.join(", ")}`,
      "",
      `Total completed: ${data.completed}`,
      `Previous period: ${data.previous_completed}` +
        (data.change_pct === null ? "" : ` (${data.change_pct > 0 ? "+" : ""}${data.change_pct}%)`),
      "",
      "By shipment type:",
      ...data.by_mode.map((m) => `  ${m.mode}: ${m.completed}`),
      "",
      "By user:",
      ...data.users.map((u) => `  ${u.name}: ${u.completed} (${u.share_pct}%)`),
    ];
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      /* the user dismissed the sheet */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Usage" subtitle={`${pretty(start)} — ${pretty(end)}`}>
        <View style={{ marginTop: spacing.lg }}>
          <ChipRow>
            {PERIODS.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                selected={p.key === periodKey}
                onPress={() => setPeriodKey(p.key)}
                color="#FFFFFF"
              />
            ))}
          </ChipRow>
        </View>
      </ScreenHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={usage.refreshing} onRefresh={usage.refresh} tintColor={t.primary} />
        }
      >
        {usage.error && !data ? <ErrorNotice message={usage.error} onRetry={usage.reload} /> : null}

        {/* Mode filter - only worth showing when there is more than one to choose from. */}
        {(identity?.allowed_modes.length ?? 0) > 1 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionLabel>Shipment types</SectionLabel>
            <ChipRow>
              {activeModes.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  selected={modes.includes(m)}
                  color={modeColor(m)}
                  onPress={() => toggleMode(m)}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}

        <Card>
          <SectionLabel>Total completed</SectionLabel>
          {usage.loading && !data ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Skeleton height={44} width="50%" />
              <Skeleton height={14} width="65%" />
            </View>
          ) : data ? (
            <>
              <View style={{ marginTop: spacing.sm }}>
                <BigStat
                  value={data.completed}
                  caption={`${pretty(data.start)} — ${pretty(data.end)}`}
                  change={data.change_pct}
                />
              </View>
              <View
                style={{
                  marginTop: spacing.lg, paddingTop: spacing.md,
                  borderTopWidth: 1, borderTopColor: t.border,
                  flexDirection: "row", justifyContent: "space-between",
                }}
              >
                <Muted>Previous period of the same length</Muted>
                <Text style={[typography.h3, { color: t.textMuted }]}>
                  {data.previous_completed}
                </Text>
              </View>
            </>
          ) : null}
        </Card>

        {data && data.by_mode.length ? (
          <Card>
            <SectionLabel>By shipment type</SectionLabel>
            <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
              {data.by_mode.map((m) => (
                <View key={m.mode}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: modeColor(m.mode) }}
                    />
                    <Text style={[typography.body, { color: t.text, flex: 1 }]}>{m.mode}</Text>
                    <ChangePill value={m.change_pct} compact />
                    <Text style={[typography.h3, { color: t.text, minWidth: 34, textAlign: "right" }]}>
                      {m.completed}
                    </Text>
                  </View>
                  <ShareBar
                    pct={data.completed ? (m.completed / data.completed) * 100 : 0}
                    color={modeColor(m.mode)}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionLabel>By user</SectionLabel>
          {usage.loading && !data ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Skeleton height={34} />
              <Skeleton height={34} />
            </View>
          ) : !data || data.users.length === 0 ? (
            <EmptyState
              title="No completed jobs in this period"
              body="Try a longer period, or a different shipment type."
              icon="·"
            />
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {data.users.map((u, i) => (
                <View
                  key={`${u.user_id ?? "none"}-${i}`}
                  style={[
                    styles.row,
                    { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[typography.small, { color: t.textFaint, width: 22 }]}>{i + 1}</Text>
                  <Text numberOfLines={1} style={[typography.body, { color: t.text, flex: 1 }]}>
                    {u.name}
                  </Text>
                  <Text style={[typography.small, { color: t.textMuted, width: 54, textAlign: "right" }]}>
                    {u.share_pct}%
                  </Text>
                  <Text style={[typography.h3, { color: t.text, width: 44, textAlign: "right" }]}>
                    {u.completed}
                  </Text>
                </View>
              ))}

              {/* The total row. The per-user rows always add up to it - an unassigned job is
                  grouped under one named row rather than dropped, so the table can never
                  contradict the number at the top of the screen. */}
              <View style={[styles.row, { borderBottomWidth: 0, paddingTop: spacing.md }]}>
                <Text style={[typography.small, { color: t.textFaint, width: 22 }]} />
                <Text style={[typography.h3, { color: t.text, flex: 1 }]}>Total</Text>
                <Text style={{ width: 54 }} />
                <Text style={[typography.h3, { color: t.primaryText, width: 44, textAlign: "right" }]}>
                  {data.completed}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {data && data.completed > 0 ? (
          <Button label="Export report" variant="ghost" onPress={exportReport} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
