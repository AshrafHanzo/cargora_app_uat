/**
 * The date picker: a button showing the current selection, and a month calendar behind it.
 *
 * Replaces an endless horizontal strip of days. The strip meant that reaching a date three
 * weeks back was a long scroll with no sense of where you were, and no way at all to see
 * which day of the week something fell on.
 *
 * Built here rather than taken from a package: the community date pickers either open the
 * platform dialog (which looks like Android/iOS, not like this app) or carry a large
 * dependency for one screen. A month grid is about eighty lines.
 *
 * It never offers a future date. There is nothing to report about tomorrow, and a future
 * day would show a confident zero that reads as "we did no work" rather than "this has not
 * happened yet".
 */
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { localDateKey } from "../api/manager";
import { radius, shadow, spacing, typography, useTheme } from "../theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "Today", "Yesterday", or "Mon, 27 Oct 2026". The two named days are what a manager
 *  actually asks for, and reading a date to work out that it means today is friction. */
export function describeDay(key: string): string {
  const today = new Date();
  if (key === localDateKey(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localDateKey(yesterday)) return "Yesterday";
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function formatDay(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function Calendar({
  value, onPick, minKey,
}: { value: string; onPick: (key: string) => void; minKey?: string }) {
  const t = useTheme();
  const selected = parseKey(value);
  const [cursor, setCursor] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const todayKey = localDateKey(new Date());

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Blank cells so the 1st lands under its real weekday - without them every month starts
    // on Sunday and the grid is quietly meaningless.
    const lead = first.getDay();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(localDateKey(new Date(year, month, d)));
    return out;
  }, [cursor]);

  // Stepping past today is pointless, so the forward arrow switches off at the current month.
  const now = new Date();
  const atCurrentMonth =
    cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();

  function step(months: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1));
  }

  return (
    <View>
      <View style={styles.monthRow}>
        <Pressable onPress={() => step(-1)} hitSlop={10} style={[styles.arrow, { backgroundColor: t.cardAlt }]}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "700" }}>‹</Text>
        </Pressable>
        <Text style={[typography.h3, { color: t.text }]}>
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Pressable
          onPress={() => !atCurrentMonth && step(1)}
          hitSlop={10}
          style={[styles.arrow, { backgroundColor: t.cardAlt, opacity: atCurrentMonth ? 0.3 : 1 }]}
        >
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "700" }}>›</Text>
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[typography.label, styles.cell, { color: t.textFaint }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((key, i) => {
          if (!key) return <View key={`b${i}`} style={styles.cell} />;
          const isSelected = key === value;
          const isToday = key === todayKey;
          const future = key > todayKey;
          const beforeMin = minKey ? key < minKey : false;
          const off = future || beforeMin;
          return (
            <Pressable
              key={key}
              disabled={off}
              onPress={() => onPick(key)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: t.primary },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: t.primary },
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    {
                      color: isSelected ? "#FFFFFF" : off ? t.textFaint : t.text,
                      fontWeight: isSelected || isToday ? "800" : "500",
                      opacity: off ? 0.4 : 1,
                    },
                  ]}
                >
                  {Number(key.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The button that sits on a screen. Tapping it opens the calendar. */
export function DateButton({
  value, onChange, label, onHeader,
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
  /** True when the button sits on the coloured header, which needs its own contrast. */
  onHeader?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: onHeader ? "rgba(255,255,255,0.18)" : t.card,
            borderColor: onHeader ? "rgba(255,255,255,0.3)" : t.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={{ fontSize: 15 }}>📅</Text>
        <Text
          style={[
            typography.body,
            { color: onHeader ? "#FFFFFF" : t.text, fontWeight: "700", flex: 1 },
          ]}
          numberOfLines={1}
        >
          {label ?? describeDay(value)}
        </Text>
        <Text style={{ color: onHeader ? "rgba(255,255,255,0.8)" : t.textMuted, fontSize: 12 }}>
          ▼
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tapping the dimmed area closes it - on a phone that is the gesture people reach
            for before hunting for a Cancel button. */}
        <Pressable style={[styles.overlay, { backgroundColor: t.overlay }]} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: t.bgElevated }, shadow.raised]}
            onPress={(e) => e.stopPropagation()}
          >
            <Calendar
              value={value}
              onPick={(key) => {
                onChange(key);
                setOpen(false);
              }}
            />
            <View style={styles.sheetFooter}>
              <Pressable
                onPress={() => {
                  onChange(localDateKey(new Date()));
                  setOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={[typography.body, { color: t.primaryText, fontWeight: "700" }]}>
                  Today
                </Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={[typography.body, { color: t.textMuted, fontWeight: "700" }]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Two dates at once, for "from — to". Used by the Usage and Reports custom ranges. */
export function DateRangeButtons({
  start, end, onChange, onHeader,
}: {
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
  onHeader?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <DateButton
          value={start}
          label={formatDay(start)}
          onHeader={onHeader}
          // Picking a start after the current end would make an impossible range, so the end
          // is pulled along with it rather than the app showing an error about it.
          onChange={(key) => onChange({ start: key, end: key > end ? key : end })}
        />
      </View>
      <Text style={[typography.body, { color: onHeader ? "rgba(255,255,255,0.8)" : t.textMuted }]}>
        —
      </Text>
      <View style={{ flex: 1 }}>
        <DateButton
          value={end}
          label={formatDay(end)}
          onHeader={onHeader}
          onChange={(key) => onChange({ start: key < start ? key : start, end: key })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  sheet: { width: "100%", maxWidth: 380, borderRadius: radius.xxl, padding: spacing.lg },
  sheetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.25)",
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", marginBottom: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // Seven to a row, so each is a seventh of the width.
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
