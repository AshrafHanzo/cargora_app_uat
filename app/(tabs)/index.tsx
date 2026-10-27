/**
 * Dashboard - one day's picture.
 *
 * Completed jobs for the chosen date, how that compares with the day before, the split by
 * shipment type, the trend over a selectable range, and who did the most.
 *
 * "Completed" here is the same definition the Cargora web portal's ERP Verified Jobs screen
 * uses - the server shares one SQL condition between them - so a manager comparing the
 * phone against the desktop sees the same number rather than two that nearly agree.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localDateKey, managerApi } from "../../src/api/manager";
import { useAuth } from "../../src/auth/AuthContext";
import { DateStrip } from "../../src/components/DateStrip";
import { ShareBar, TrendChart } from "../../src/components/TrendChart";
import {
  BigStat, Card, ChangePill, Chip, ChipRow, EmptyState, ErrorNotice, ModeStat, Muted,
  ScreenHeader, SectionLabel, Skeleton,
} from "../../src/components/ui";
import { useAsync } from "../../src/hooks/useAsync";
import { modeColor, radius, spacing, typography, useTheme } from "../../src/theme";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "long",
  });
}

export default function DashboardScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { identity, activeModes } = useAuth();

  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [rangeDays, setRangeDays] = useState(7);
  const [showAllUsers, setShowAllUsers] = useState(false);

  // activeModes is an array rebuilt each render, so it is joined into a string for the
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
        subtitle={
          activeModes.length === (identity?.allowed_modes.length ?? 0)
            ? "All your shipment types"
            : activeModes.join(" · ")
        }
      >
        <DateStrip value={date} onChange={setDate} />
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

        {/* ------------------------------------------------- the headline number */}
        <Card>
          <SectionLabel>Completed jobs</SectionLabel>
          {dash.loading && !data ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Skeleton height={44} width="55%" />
              <Skeleton height={14} width="70%" />
            </View>
          ) : data ? (
            <>
              <View style={{ marginTop: spacing.sm }}>
                <BigStat
                  value={data.completed}
                  caption={prettyDate(data.date)}
                  change={data.change_pct}
                />
              </View>
              <View
                style={{
                  marginTop: spacing.lg, paddingTop: spacing.md,
                  borderTopWidth: 1, borderTopColor: t.border,
                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <Muted>
                  Previous day · {prettyDate(data.previous_date)}
                </Muted>
                <Text style={[typography.h3, { color: t.textMuted }]}>
                  {data.previous_completed}
                </Text>
              </View>
            </>
          ) : null}
        </Card>

        {/* ------------------------------------------------- per shipment type */}
        {data && data.by_mode.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionLabel>By shipment type</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {data.by_mode.map((m) => (
                <ModeStat
                  key={m.mode}
                  mode={m.mode}
                  completed={m.completed}
                  change={m.change_pct}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ------------------------------------------------- trend */}
        <Card>
          <View
            style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <SectionLabel>Completed jobs trend</SectionLabel>
            {trend.data ? (
              <Text style={[typography.small, { color: t.textMuted }]}>
                {trend.data.total} total
              </Text>
            ) : null}
          </View>

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

          <View style={{ marginTop: spacing.md }}>
            {trend.loading && !trend.data ? (
              <Skeleton height={170} />
            ) : trend.data && trend.data.points.length ? (
              <TrendChart points={trend.data.points} />
            ) : (
              <EmptyState
                title="Nothing to chart yet"
                body="Once jobs start completing, the daily trend appears here."
              />
            )}
          </View>
        </Card>

        {/* ------------------------------------------------- top users */}
        <Card>
          <View
            style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <SectionLabel>Top performers</SectionLabel>
            {users.length > 3 ? (
              <Text
                onPress={() => setShowAllUsers((v) => !v)}
                style={[typography.small, { color: t.primaryText, fontWeight: "700" }]}
              >
                {showAllUsers ? "Show less" : "View all"}
              </Text>
            ) : null}
          </View>

          {dash.loading && !data ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Skeleton height={40} />
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
                      style={{
                        width: 30, height: 30, borderRadius: 15,
                        backgroundColor: i === 0 ? t.primary : t.cardAlt,
                        alignItems: "center", justifyContent: "center",
                      }}
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

        {/* A failed REFRESH when there is already data on screen: say so without throwing
            the numbers away, since stale-but-labelled beats blank. */}
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
