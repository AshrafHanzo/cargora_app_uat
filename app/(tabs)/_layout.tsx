/**
 * The bottom navigation: Dashboard, Usage, Reports, Profile.
 *
 * The icons are drawn as small SVGs rather than pulled from an icon font. One dependency
 * fewer, they take the theme's colours directly, and four shapes is less code than the
 * package that would supply them.
 */
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { typography, useTheme } from "../../src/theme";

// `color` arrives from expo-router as a ColorValue, which widens to include null. The
// icons below feed it straight to SVG stroke/fill props that want a plain string, so it
// is narrowed once here rather than cast at each of the twelve places it is used.
type IconProps = { color: string; focused: boolean };

function DashboardIcon({ color, focused }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7.5" height="9" rx="2" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="13.5" y="3" width="7.5" height="5.5" rx="2" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="13.5" y="12" width="7.5" height="9" rx="2" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="3" y="15.5" width="7.5" height="5.5" rx="2" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function UsageIcon({ color, focused }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="12" width="4.5" height="9" rx="1.5" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="9.75" y="7" width="4.5" height="14" rx="1.5" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="16.5" y="3" width="4.5" height="18" rx="1.5" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function ReportsIcon({ color, focused }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        fill={focused ? color : "none"}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M14 3v5h5" stroke={focused ? "#FFFFFF" : color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8.5 13h7M8.5 17h4.5" stroke={focused ? "#FFFFFF" : color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ color, focused }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Path
        d="M4.5 20.5a7.5 7.5 0 0 1 15 0"
        fill={focused ? color : "none"}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textFaint,
        tabBarStyle: {
          backgroundColor: t.bgElevated,
          borderTopColor: t.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { ...typography.label, letterSpacing: 0.2, textTransform: "none" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ color, focused }) => <DashboardIcon color={String(color)} focused={focused} /> }}
      />
      <Tabs.Screen
        name="usage"
        options={{ title: "Usage", tabBarIcon: ({ color, focused }) => <UsageIcon color={String(color)} focused={focused} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: "Reports", tabBarIcon: ({ color, focused }) => <ReportsIcon color={String(color)} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <ProfileIcon color={String(color)} focused={focused} /> }}
      />
    </Tabs>
  );
}
