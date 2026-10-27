/**
 * Reports - the finished jobs themselves, for a date range and set of shipment types.
 *
 * Usage answers "how many"; this answers "which ones". Each row is a real job: its number,
 * its customer, who handled it, and when it actually reached the ERP.
 *
 * The count at the top is the TRUE total even when the list below is capped by the server,
 * so the number a manager quotes is never "however many happened to fit in one response".
 */
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localDateKey, managerApi, ReportRow } from "../../src/api/manager";
import { useAuth } from "../../src/auth/AuthContext";
import {
  Button, Card, Chip, ChipRow, EmptyState, ErrorNotice, Muted, ScreenHeader, SectionLabel,
  Skeleton,
} from "../../src/components/ui";
import { useAsync } from "../../src/hooks/useAsync";
import { modeColor, modeInitials, radius, spacing, typography, useTheme } from "../../src/theme";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "month", label: "This month", days: 0 },
  { key: "90", label: "Last 90 days", days: 90 },
];

function rangeFor(key: string): { start: string; end: string } {
  const end = new Date();
  if (key === "month") {
    return {
      start: localDateKey(new Date(end.getFullYear(), end.getMonth(), 1)),
      end: localDateKey(end),
    };
  }
  const days = Number(key);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { start: localDateKey(start), end: localDateKey(end) };
}

/** The finish time, in the reader's own timezone. The server sends UTC; a job completed at
 *  02:00 IST is 20:30 UTC the day before, and showing that raw would put it on the wrong
 *  day on the one screen whose whole purpose is dates. */
function finishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : localDateKey(d);
}

function dayHeading(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = localDateKey(new Date());
  if (key === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDateKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export default function ReportsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { identity, activeModes } = useAuth();

  const [rangeKey, setRangeKey] = useState("30");
  const [modeFilter, setModeFilter] = useState<string[] | null>(null);

  const { start, end } = useMemo(() => rangeFor(rangeKey), [rangeKey]);
  const modes = modeFilter ?? activeModes;
  const modeKey = modes.join(",");

  const report = useAsync(
    (signal) => managerApi.reports(start, end, modes, signal),
    [start, end, modeKey],
  );
  const data = report.data;

  function toggleMode(mode: string) {
    const current = modeFilter ?? activeModes;
    const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
    setModeFilter(next.length === 0 ? null : next);
  }

  /** Rows grouped under the day they finished, so a long list reads as a diary rather than
   *  as five hundred identical lines. */
  const grouped = useMemo(() => {
    const out: { day: string; rows: ReportRow[] }[] = [];
    for (const row of data?.rows ?? []) {
      const key = dayKeyOf(row.completed_at);
      const last = out[out.length - 1];
      if (last && last.day === key) last.rows.push(row);
      else out.push({ day: key, rows: [row] });
    }
    return out;
  }, [data]);

  async function exportList() {
    if (!data) return;
    const lines = [
      `${identity?.company_name ?? "Cargora"} — completed jobs`,
      `${start} to ${end}`,
      `Shipment types: ${data.modes.join(", ")}`,
      `Total: ${data.total}`,
      "",
      ...data.rows.map(
        (r) =>
          `${r.reference} | ${r.mode ?? "—"} | ${r.customer_name ?? "—"} | ${
            r.operator_name ?? "Unassigned"
          } | ${finishedAt(r.completed_at)}`,
      ),
    ];
    if (data.rows.length < data.total) {
      lines.push("", `(showing the most recent ${data.rows.length} of ${data.total})`);
    }
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      /* dismissed */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader
        title="Reports"
        subtitle={data ? `${data.total} completed` : "Completed jobs"}
      >
        <View style={{ marginTop: spacing.lg }}>
          <ChipRow>
            {RANGES.map((r) => (
              <Chip
                key={r.key}
                label={r.label}
                selected={r.key === rangeKey}
                onPress={() => setRangeKey(r.key)}
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
          <RefreshControl refreshing={report.refreshing} onRefresh={report.refresh} tintColor={t.primary} />
        }
      >
        {report.error && !data ? <ErrorNotice message={report.error} onRetry={report.reload} /> : null}

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

        {report.loading && !data ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={76} />
            <Skeleton height={76} />
            <Skeleton height={76} />
          </View>
        ) : !data || data.rows.length === 0 ? (
          <Card>
            <EmptyState
              title="No completed jobs"
              body="Nothing finished in this period for the selected shipment types. Try a longer range."
            />
          </Card>
        ) : (
          <>
            {grouped.map((group) => (
              <View key={group.day} style={{ gap: spacing.sm }}>
                <SectionLabel>{dayHeading(group.day)}</SectionLabel>
                {group.rows.map((row) => (
                  <Card key={row.job_id} style={{ padding: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <View
                        style={{
                          width: 38, height: 38, borderRadius: radius.md,
                          backgroundColor: row.mode ? modeColor(row.mode) : t.cardAlt,
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>
                          {row.mode ? modeInitials(row.mode) : "?"}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[typography.h3, { color: t.text }]}>
                          {row.reference}
                        </Text>
                        <Text numberOfLines={1} style={[typography.small, { color: t.textMuted, marginTop: 1 }]}>
                          {row.customer_name ?? "Customer not read"}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.footer,
                        { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <Muted numberOfLines={1} style={{ flex: 1 }}>
                        {row.operator_name ?? "Unassigned"}
                      </Muted>
                      <Text style={[typography.small, { color: t.successText, fontWeight: "700" }]}>
                        {finishedAt(row.completed_at)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ))}

            {data.rows.length < data.total ? (
              <Card style={{ backgroundColor: t.warningSoft, borderColor: t.warning }}>
                <Muted style={{ color: t.text }}>
                  Showing the most recent {data.rows.length} of {data.total}. Narrow the date
                  range or shipment types to see the rest.
                </Muted>
              </Card>
            ) : null}

            <Button label="Export list" variant="ghost" onPress={exportList} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
});
