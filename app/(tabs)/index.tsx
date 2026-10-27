/**
 * Dashboard - one day's picture.
 *
 * Completed jobs for the chosen date, split by shipment type, how it compares with the day
 * before, the trend over a selectable range, and who did the most.
 *
 * "Completed" is the same definition the Cargora web portal's ERP Verified Jobs screen uses
 * - the server shares one SQL condition between them - so a manager comparing the phone
 * against the desktop sees the same number rather than two that nearly agree.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localDateKey, managerApi } from "../../src/api/manager";
import { useAuth } from "../../src/auth/AuthContext";
import { BarChart, ShareBar } from "../../src/components/BarChart";
import { DateButton, describeDay } from "../../src/components/DatePicker";
import { ModeIcon } from "../../src/components/ModeIcon";
import {
  Card, ChangePill, Chip, ChipRow, EmptyState, ErrorNotice, Muted, ScreenHeader,
  SectionLabel, Skeleton,
} from "../../src/components/ui";
import { useAsync } from "../../src/hooks/useAsync";
import { modeColor, radius, spacing, typography, useTheme } from "../../src/theme";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function DashboardScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { identity, activeModes } = useAuth();

  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [rangeDays, setRangeDays] = useState(7);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // activeModes is a fresh array each render, so it is joined into a string for the
  // dependency list - otherwise every render looks like a filter change and refetches.
  const modeKey = activeModes.join(",");

  const dash = useAsync(
    (signal) => managerApi.dashboard(date, activeModes, signal),
    [date, modeKey],
  );
  const trend = useAsync(
    (signal) => managerApi.trend(rangeDays, date, activeModes, signal),
    [date, rangeDays, modeKey],
  );

  const refresh = useCallback(() => {
    dash.refresh();
    trend.refresh();
  }, [dash, trend]);

  const data = dash.data;
  const users = useMemo(() => data?.top_users ?? [], [data]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader
        title={identity?.company_name ?? "Dashboard"}
        subtitle="Completed jobs across your operation"
      >
        <View style={{ marginTop: spacing.lg }}>
          <DateButton value={date} onChange={setDate} onHeader />
        </View>
      </ScreenHeader>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={dash.refreshing || trend.refreshing}
            onRefresh={refresh}
            tintColor={t.primary}
          />
        }
      >
        {dash.error && !data ? (
          <ErrorNotice message={dash.error} onRetry={dash.reload} />
        ) : null}

        {/* ---------------------------------------------- per shipment type, two across */}
        {dash.loading && !data ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={104} width="48%" />
            ))}
          </View>
        ) : data ? (
          <View style={styles.modeGrid}>
            {data.by_mode.map((m) => (
              <Card key={m.mode} style={styles.modeCard}>
                <View style={styles.modeHead}>
                  <View style={[styles.modeIconBox, { backgroundColor: `${modeColor(m.mode)}1A` }]}>
                    <ModeIcon mode={m.mode} size={20} />
                  </View>
                  <Text numberOfLines={1} style={[typography.small, { color: t.textMuted, flex: 1 }]}>
                    {m.mode}
                  </Text>
                </View>
                <Text style={[typography.h1, { color: t.text, marginTop: spacing.sm }]}>
                  {m.completed}
                </Text>
                <View style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}>
                  <ChangePill value={m.change_pct} compact />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* ---------------------------------------------- the headline total */}
        <Card>
          {dash.loading && !data ? (
            <View style={{ gap: spacing.sm }}>
              <Skeleton height={40} width="50%" />
              <Skeleton height={14} width="70%" />
            </View>
          ) : data ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[styles.totalIcon, { backgroundColor: t.primarySoft }]}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <SectionLabel>Total completed jobs</SectionLabel>
                  <Text style={[typography.display, { color: t.text, marginTop: 2 }]}>
                    {data.completed}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <ChangePill value={data.change_pct} />
                  <Muted style={{ fontSize: 11 }}>vs previous day</Muted>
                </View>
              </View>
              <View style={[styles.divider, { borderTopColor: t.border }]}>
                <Muted>{describeDay(data.date)}</Muted>
                <Muted>
                  Day before: <Text style={{ color: t.text, fontWeight: "700" }}>{data.previous_completed}</Text>
                </Muted>
              </View>
            </>
          ) : null}
        </Card>

        {/* ---------------------------------------------- trend */}
        <Card>
          <View style={styles.cardHead}>
            <SectionLabel>Completed jobs trend</SectionLabel>
            {trend.data ? (
              <Text style={[typography.small, { color: t.textMuted }]}>
                {trend.data.total} in {rangeDays} days
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <ChipRow>
              {RANGES.map((r) => (
                <Chip
                  key={r.days}
                  label={r.label}
                  selected={rangeDays === r.days}
                  onPress={() => setRangeDays(r.days)}
                />
              ))}
            </ChipRow>
          </View>

          <View style={{ marginTop: spacing.md }}>
            {trend.loading && !trend.data ? (
              <Skeleton height={150} />
            ) : trend.data && trend.data.points.length ? (
              <BarChart points={trend.data.points} />
            ) : (
              <EmptyState
                title="Nothing to chart yet"
                body="Once jobs start completing, the daily trend appears here."
              />
            )}
          </View>

          {/* Said out loud, because a flat empty chart otherwise looks like a broken screen
              rather than a range that genuinely contains nothing. */}
          {trend.data && trend.data.total === 0 ? (
            <Muted style={{ marginTop: spacing.md }}>
              No jobs completed in the {rangeDays} days up to {describeDay(date)}. Try a longer
              range, or pick a different date above.
            </Muted>
          ) : null}
        </Card>

        {/* ---------------------------------------------- top users */}
        <Card>
          <View style={styles.cardHead}>
            <SectionLabel>Top performers</SectionLabel>
            {users.length > 3 ? (
              <Pressable onPress={() => setShowAllUsers((v) => !v)} hitSlop={8}>
                <Text style={[typography.small, { color: t.primaryText, fontWeight: "700" }]}>
                  {showAllUsers ? "Show less" : "View all"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {dash.loading && !data ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
            </View>
          ) : users.length === 0 ? (
            <EmptyState
              title="No completed jobs on this day"
              body="Pick another date above, or pull down to refresh."
              icon="·"
            />
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
              {(showAllUsers ? users : users.slice(0, 3)).map((u, i) => (
                <View key={`${u.user_id ?? "none"}-${i}`}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View
                      style={[
                        styles.rank,
                        { backgroundColor: i === 0 ? t.primary : t.cardAlt },
                      ]}
                    >
                      <Text
                        style={{
                          fontWeight: "800", fontSize: 13,
                          color: i === 0 ? "#FFFFFF" : t.textMuted,
                        }}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={[typography.body, { color: t.text, flex: 1 }]}>
                      {u.name}
                    </Text>
                    <Text style={[typography.h3, { color: t.text }]}>{u.completed}</Text>
                  </View>
                  <ShareBar pct={u.share_pct} color={i === 0 ? t.primary : t.borderStrong} />
                </View>
              ))}
            </View>
          )}
        </Card>

        {dash.error && data ? (
          <Card style={{ backgroundColor: t.warningSoft, borderColor: t.warning }}>
            <Muted style={{ color: t.text }}>
              Showing the last figures loaded — {dash.error}
            </Muted>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // Two to a row: four shipment types is the usual case, and three across makes the numbers
  // too small to read at a glance, which is the whole job of this grid.
  modeCard: { width: "48%", flexGrow: 1, padding: spacing.md },
  modeHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modeIconBox: { width: 34, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  totalIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  divider: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
