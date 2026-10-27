/**
 * The Completed Jobs Trend chart.
 *
 * Drawn by hand with react-native-svg rather than pulled from a charting library. Three
 * reasons, all of which showed up while building it: a library's defaults look like a
 * library, most of them do not handle an all-zero series (which a quiet week genuinely is),
 * and the ones that do are heavy for one chart on one screen.
 *
 * It is a smoothed area chart with a point per day. Tapping a point selects it and reports
 * its value, because a phone has no hover and a chart you cannot read exact numbers off is
 * decoration.
 */
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { radius, spacing, typography, useTheme } from "../theme";
import { TrendPoint } from "../api/manager";

const HEIGHT = 170;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

/** A Catmull-Rom spline through the points, converted to cubic Béziers.
 *
 * A straight polyline looks jagged on daily counts; a smoothed line reads as a trend, which
 * is what the chart is for. The tension is deliberately low (0.18) - too much and the curve
 * overshoots between a 0 and a spike, drawing a dip below zero that never happened. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const t = 0.18;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function shortDate(iso: string): string {
  // Parsed as local parts, not through Date(iso) - that treats a bare date as UTC and in
  // India shows the previous day.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const geometry = useMemo(() => {
    if (!width || points.length === 0) return null;
    const max = Math.max(...points.map((p) => p.completed));
    // An all-zero week is a real result, not an error. Without this floor every point sits
    // on the top edge, because everything divides by its own maximum.
    const ceiling = max === 0 ? 1 : max;
    const usableH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = points.length > 1 ? width / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
      x: points.length === 1 ? width / 2 : i * step,
      y: PAD_TOP + usableH - (p.completed / ceiling) * usableH,
    }));
    return { coords, max, ceiling, usableH };
  }, [width, points]);

  const active = selected !== null ? points[selected] : null;

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[typography.small, { color: t.textMuted }]}>
          {active ? shortDate(active.date) : "Completed per day"}
        </Text>
        <Text style={[typography.h3, { color: active ? t.primaryText : t.textFaint }]}>
          {active ? `${active.completed}` : geometry ? `peak ${geometry.max}` : ""}
        </Text>
      </View>

      <View onLayout={onLayout} style={{ height: HEIGHT, marginTop: spacing.sm }}>
        {geometry && width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.primary} stopOpacity="0.28" />
                <Stop offset="1" stopColor={t.primary} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Three faint guides, not a full grid - enough to judge height against, little
                enough that the line stays the thing you look at. */}
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={0}
                x2={width}
                y1={PAD_TOP + geometry.usableH * f}
                y2={PAD_TOP + geometry.usableH * f}
                stroke={t.border}
                strokeWidth={1}
                strokeDasharray="4 6"
              />
            ))}

            <Path
              d={`${smoothPath(geometry.coords)} L ${geometry.coords[geometry.coords.length - 1].x} ${
                PAD_TOP + geometry.usableH
              } L ${geometry.coords[0].x} ${PAD_TOP + geometry.usableH} Z`}
              fill="url(#fill)"
            />
            <Path
              d={smoothPath(geometry.coords)}
              stroke={t.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {geometry.coords.map((c, i) => (
              <G key={i}>
                {selected === i ? (
                  <Line
                    x1={c.x}
                    x2={c.x}
                    y1={PAD_TOP}
                    y2={PAD_TOP + geometry.usableH}
                    stroke={t.primary}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                ) : null}
                <Circle
                  cx={c.x}
                  cy={c.y}
                  r={selected === i ? 5.5 : points.length > 31 ? 0 : 3}
                  fill={selected === i ? t.primary : t.card}
                  stroke={t.primary}
                  strokeWidth={2}
                />
              </G>
            ))}
          </Svg>
        ) : null}

        {/* Touch targets sit over the chart as a row of full-height strips: on a phone the
            dot itself is far too small to hit, and a strip means a tap anywhere in that
            day's column selects it. */}
        {geometry && width > 0 ? (
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEIGHT, flexDirection: "row" }}>
            {points.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setSelected(selected === i ? null : i)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Only the ends are labelled. Every day labelled turns to mush past about ten points,
          and the tap-to-read above covers the ones in between. */}
      {points.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
          <Text style={[typography.small, { color: t.textFaint }]}>{shortDate(points[0].date)}</Text>
          <Text style={[typography.small, { color: t.textFaint }]}>
            {shortDate(points[points.length - 1].date)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The horizontal bar used in the "top users" list - same idea, far less machinery. */
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
