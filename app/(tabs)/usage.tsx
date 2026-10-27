/**
 * Usage - who completed what, over a period.
 *
 * Today / This month / Custom, plus the shipment-type filter. The comparison is always
 * against the SAME LENGTH period immediately before, not "last month": comparing three days
 * against thirty-one produces a percentage that is simply wrong, and it is exactly the kind
 * that gets repeated in a meeting.
 */
import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localDateKey, managerApi } from "../../src/api/manager";
import { useAuth } from "../../src/auth/AuthContext";
import { ShareBar } from "../../src/components/BarChart";
import { DateRangeButtons, formatDay } from "../../src/components/DatePicker";
import { ModeIcon } from "../../src/components/ModeIcon";
import {
  BigStat, Button, Card, ChangePill, Chip, ChipRow, EmptyState, ErrorNotice, Muted,
  ScreenHeader, SectionLabel, Skeleton,
} from "../../src/components/ui";
import { useAsync } from "../../src/hooks/useAsync";
import { modeColor, radius, spacing, typography, useTheme } from "../../src/theme";

type PeriodKey = "today" | "month" | "custom";

function todayKey(): string {
  return localDateKey(new Date());
}

function monthStart(): string {
  const now = new Date();
  return localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function UsageScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { identity, activeModes } = useAuth();

  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  // Only consulted when the period is "custom", but kept primed with this month so opening
  // the pickers never starts on a blank or nonsense range.
  const [custom, setCustom] = useState({ start: monthStart(), end: todayKey() });
  // Null means "every type this phone is set to". A tick narrows THIS screen only, leaving
  // the phone's saved preference alone - it is a look, not a setting.
  const [modeFilter, setModeFilter] = useState<string[] | null>(null);

  const { start, end } = useMemo(() => {
    if (periodKey === "today") return { start: todayKey(), end: todayKey() };
    if (periodKey === "custom") return custom;
    return { start: monthStart(), end: todayKey() };
  }, [periodKey, custom]);

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
    // Share rather than writing a file: the phone's own sheet covers WhatsApp, mail and
    // Slack, and forwarding a number to the team is what "export" means on a phone.
    const lines = [
      `${identity?.company_name ?? "Cargora"} — completed jobs`,
      `${formatDay(data.start)} to ${formatDay(data.end)}`,
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

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "month", label: "This Month" },
    { key: "custom", label: "Custom Date" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Usage" subtitle="User-wise completed jobs">
        {/* A segmented control, not chips. Three mutually exclusive choices that always sit
            in the same place are far easier to hit than a row that scrolls - and the
            previous version used a white "selected" colour on a white background, which made
            the chosen one unreadable. */}
        <View style={[styles.segment, { marginTop: spacing.lg }]}>
          {periods.map((p) => {
            const on = p.key === periodKey;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPeriodKey(p.key)}
                style={[styles.segmentItem, on && { backgroundColor: "#FFFFFF" }]}
              >
                <Text
                  style={[
                    typography.small,
                    { color: on ? "#4338CA" : "rgba(255,255,255,0.9)", fontWeight: "700" },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {periodKey === "custom" ? (
          <View style={{ marginTop: spacing.md }}>
            <DateRangeButtons
              start={custom.start}
              end={custom.end}
              onChange={setCustom}
              onHeader
            />
          </View>
        ) : (
          <Text style={[typography.small, { color: "rgba(255,255,255,0.85)", marginTop: spacing.md }]}>
            {formatDay(start)} — {formatDay(end)}
          </Text>
        )}
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
                  caption={`${formatDay(data.start)} — ${formatDay(data.end)}`}
                  change={data.change_pct}
                />
              </View>
              <View style={[styles.divider, { borderTopColor: t.border }]}>
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
                    <View style={[styles.miniIcon, { backgroundColor: `${modeColor(m.mode)}1A` }]}>
                      <ModeIcon mode={m.mode} size={16} />
                    </View>
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
              <View style={[styles.row, { borderBottomColor: t.border, paddingBottom: spacing.sm }]}>
                <Text style={[typography.label, { color: t.textFaint, width: 22 }]}>#</Text>
                <Text style={[typography.label, { color: t.textFaint, flex: 1 }]}>USER</Text>
                <Text style={[typography.label, { color: t.textFaint, width: 54, textAlign: "right" }]}>
                  SHARE
                </Text>
                <Text style={[typography.label, { color: t.textFaint, width: 44, textAlign: "right" }]}>
                  JOBS
                </Text>
              </View>

              {data.users.map((u, i) => (
                <View
                  key={`${u.user_id ?? "none"}-${i}`}
                  style={[styles.row, { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
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

              {/* The total. The per-user rows always add up to it - an unassigned job is
                  grouped under one named row rather than dropped, so the table can never
                  contradict the number at the top of the screen. */}
              <View style={[styles.row, { borderBottomWidth: 0, paddingTop: spacing.md }]}>
                <Text style={{ width: 22 }} />
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
  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.lg,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  divider: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  miniIcon: { width: 26, height: 26, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
