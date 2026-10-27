/**
 * The Completed Jobs Trend chart, as bars.
 *
 * Bars rather than the smoothed line this started as. Daily completion counts are discrete
 * events, not a continuous quantity: a line between Tuesday's 4 and Thursday's 6 draws a
 * Wednesday value that never existed, and a curve through an all-zero week looks like data.
 * Bars also make a zero day read as a zero day rather than as a gap.
 *
 * Tap a bar to read its exact value - a phone has no hover, and a chart whose numbers can
 * only be guessed at is decoration.
 */
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";

import { TrendPoint } from "../api/manager";
import { radius, spacing, typography, useTheme } from "../theme";

const CHART_HEIGHT = 150;
const MIN_BAR_WIDTH = 26;
/** Enough of a stub that a zero day is visibly a bar at zero rather than nothing at all. */
const ZERO_STUB = 3;

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    day: "numeric", month: "short",
  });
}

function dayNumber(iso: string): string {
  return String(Number(iso.slice(8)));
}

export function BarChart({ points }: { points: TrendPoint[] }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const max = useMemo(() => Math.max(1, ...points.map((p) => p.completed)), [points]);

  // Past about a fortnight the bars get too thin to tap, so the chart scrolls sideways
  // instead of squeezing. Below that it fills the width.
  const barWidth = width > 0 ? Math.max(MIN_BAR_WIDTH, width / Math.max(points.length, 1)) : 0;
  const scrolls = points.length > 0 && barWidth * points.length > width;

  const active = selected !== null ? points[selected] : null;

  const bars = (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT }}>
      {points.map((p, i) => {
        const isActive = selected === i;
        const h = Math.max(ZERO_STUB, (p.completed / max) * (CHART_HEIGHT - 28));
        return (
          <Pressable
            key={p.date}
            onPress={() => setSelected(isActive ? null : i)}
            style={{ width: barWidth, alignItems: "center", justifyContent: "flex-end" }}
          >
            {/* The value sits above its own bar, but only for the tallest or the tapped one -
                every bar labelled turns into noise at this width. */}
            {(isActive || (p.completed === max && p.completed > 0)) && (
              <Text
                style={[
                  typography.small,
                  { color: isActive ? t.primaryText : t.textMuted, fontWeight: "800", marginBottom: 2 },
                ]}
              >
                {p.completed}
              </Text>
            )}
            <View
              style={{
                width: barWidth * 0.56,
                height: h,
                borderRadius: radius.sm,
                backgroundColor:
                  p.completed === 0 ? t.border : isActive ? t.primary : t.primarySoft,
                borderWidth: p.completed > 0 && !isActive ? 1 : 0,
                borderColor: t.primary,
              }}
            />
            <Text
              numberOfLines={1}
              style={[
                typography.small,
                {
                  color: isActive ? t.primaryText : t.textFaint,
                  fontWeight: isActive ? "800" : "500",
                  marginTop: spacing.xs,
                  fontSize: 11,
                },
              ]}
            >
              {points.length > 14 ? dayNumber(p.date) : shortDate(p.date)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[typography.small, { color: t.textMuted }]}>
          {active ? shortDate(active.date) : "Tap a bar for its exact count"}
        </Text>
        <Text style={[typography.h3, { color: active ? t.primaryText : t.textFaint }]}>
          {active ? active.completed : `peak ${max > 1 || points.some((p) => p.completed) ? max : 0}`}
        </Text>
      </View>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: spacing.md }}>
        {width > 0 ? (
          scrolls ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bars}
            </ScrollView>
          ) : (
            bars
          )
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}
      </View>
    </View>
  );
}

/** The horizontal bar behind a user's name in the rankings. */
export function ShareBar({ pct, color }: { pct: number; color: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: t.cardAlt,
        overflow: "hidden",
        marginTop: spacing.sm,
      }}
    >
      <View
        style={{
          width: `${Math.max(2, Math.min(100, pct))}%`,
          height: "100%",
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
