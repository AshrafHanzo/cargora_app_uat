/**
 * The date picker on the Dashboard.
 *
 * A horizontal strip of recent days rather than a calendar dialog. A manager checking "how
 * did we do today, and yesterday?" wants one tap, not three - and the comparison the
 * dashboard shows is always against the previous day, so the days either side are exactly
 * what gets looked at next.
 *
 * It only ever offers today and the past. There is nothing to report about tomorrow, and a
 * future date would show a confident, meaningless zero.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { ScrollView, Text, View } from "react-native";

import { localDateKey } from "../api/manager";
import { spacing, typography } from "../theme";
import { HeaderChip } from "./ui";

const DAYS_OFFERED = 30;

function label(d: Date, today: Date): string {
  const key = localDateKey(d);
  if (key === localDateKey(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localDateKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function DateStrip({
  value, onChange,
}: { value: string; onChange: (date: string) => void }) {
  // ComponentRef, not ElementRef: React Native 0.88 types ScrollView as a function
  // component, so ElementRef resolves to the component itself rather than its instance
  // and scrollToEnd is not on it.
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const days = useMemo(() => {
    const today = new Date();
    const out: { key: string; text: string }[] = [];
    // Oldest first, so the newest sits at the right-hand end where the strip opens.
    for (let i = DAYS_OFFERED - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push({ key: localDateKey(d), text: label(d, today) });
    }
    return out;
  }, []);

  // Open on Today rather than a month ago. scrollToEnd without a frame's delay runs before
  // the content has been measured and does nothing.
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <View>
      <Text
        style={[
          typography.label,
          { color: "rgba(255,255,255,0.7)", marginTop: spacing.lg, marginBottom: spacing.sm },
        ]}
      >
        DATE
      </Text>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
      >
        {days.map((d) => (
          <HeaderChip
            key={d.key}
            label={d.text}
            selected={d.key === value}
            onPress={() => onChange(d.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
