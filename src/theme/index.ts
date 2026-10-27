/**
 * One place for every colour, size and shadow in the app.
 *
 * Screens never hard-code a hex value. That is not tidiness for its own sake: the app has a
 * real dark mode, and a single literal `#fff` left in a screen is an invisible white card on
 * a black background that nobody notices until a manager opens it at night.
 *
 * The palette deliberately echoes the Cargora web portal - the same indigo for actions, the
 * same emerald for "finished" - so the phone and the desktop read as one product rather than
 * two things that happen to share a name.
 */
import { useColorScheme } from "react-native";

export type Scheme = "light" | "dark";

const palette = {
  indigo: {
    50: "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE", 300: "#A5B4FC",
    400: "#818CF8", 500: "#6366F1", 600: "#4F46E5", 700: "#4338CA", 900: "#312E81",
  },
  emerald: {
    50: "#ECFDF5", 100: "#D1FAE5", 300: "#6EE7B7", 500: "#10B981", 600: "#059669", 700: "#047857",
  },
  rose: { 50: "#FFF1F2", 100: "#FFE4E6", 500: "#F43F5E", 600: "#E11D48", 700: "#BE123C" },
  amber: { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
  sky: { 50: "#F0F9FF", 100: "#E0F2FE", 500: "#0EA5E9", 600: "#0284C7" },
  slate: {
    50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8",
    500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A", 950: "#020617",
  },
  white: "#FFFFFF",
};

/** Each shipment mode gets its own colour, used identically everywhere it appears - the
 *  mode chips, the per-mode cards and the chart legend. A manager learns "teal means Air
 *  Import" once and it holds across every screen. */
export const MODE_COLORS: Record<string, string> = {
  "Sea Import": "#0EA5E9",
  "Sea Export": "#0D9488",
  "Air Import": "#8B5CF6",
  "Air Export": "#A855F7",
  "Road Import": "#F59E0B",
  "Road Export": "#D97706",
  "Train Import": "#EC4899",
  "Train Export": "#DB2777",
};

export function modeColor(mode: string): string {
  return MODE_COLORS[mode] ?? palette.slate[500];
}

/** A short label for a tight space - "Sea Import" becomes "SI". */
export function modeInitials(mode: string): string {
  return mode
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** expo-linear-gradient insists on at least two colours and reads the array as a tuple, so
 *  the shape is declared rather than inferred - otherwise the light theme's literal values
 *  become its type and the dark theme cannot satisfy it. */
type Gradient = readonly [string, string, ...string[]];

const light = {
  scheme: "light" as Scheme,
  bg: palette.slate[50],
  bgElevated: palette.white,
  card: palette.white,
  cardAlt: palette.slate[50],
  border: palette.slate[200],
  borderStrong: palette.slate[300],
  text: palette.slate[900],
  textMuted: palette.slate[500],
  textFaint: palette.slate[400],
  textInverse: palette.white,
  primary: palette.indigo[600],
  primarySoft: palette.indigo[50],
  primaryText: palette.indigo[700],
  success: palette.emerald[600],
  successSoft: palette.emerald[50],
  successText: palette.emerald[700],
  danger: palette.rose[600],
  dangerSoft: palette.rose[50],
  dangerText: palette.rose[700],
  warning: palette.amber[600],
  warningSoft: palette.amber[50],
  /** The gradient behind every screen header. */
  headerGradient: [palette.indigo[600], palette.indigo[500], "#5B6CF9"] as Gradient,
  skeleton: palette.slate[200],
  overlay: "rgba(15,23,42,0.45)",
};

const dark: typeof light = {
  ...light,
  scheme: "dark",
  bg: palette.slate[950],
  bgElevated: palette.slate[900],
  card: palette.slate[900],
  cardAlt: palette.slate[800],
  border: "#1E293B",
  borderStrong: palette.slate[700],
  text: palette.slate[50],
  textMuted: palette.slate[400],
  textFaint: palette.slate[500],
  textInverse: palette.slate[900],
  primary: palette.indigo[400],
  primarySoft: "rgba(99,102,241,0.15)",
  primaryText: palette.indigo[300],
  success: palette.emerald[500],
  successSoft: "rgba(16,185,129,0.15)",
  successText: palette.emerald[300],
  danger: palette.rose[500],
  dangerSoft: "rgba(244,63,94,0.15)",
  dangerText: "#FDA4AF",
  warning: palette.amber[500],
  warningSoft: "rgba(245,158,11,0.15)",
  headerGradient: [palette.indigo[900], "#3730A3", palette.indigo[700]] as Gradient,
  skeleton: palette.slate[800],
  overlay: "rgba(0,0,0,0.6)",
};

export type Theme = typeof light;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40,
} as const;

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999,
} as const;

export const typography = {
  /** The one big number on a card. */
  display: { fontSize: 40, fontWeight: "800" as const, letterSpacing: -1.2 },
  h1: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  small: { fontSize: 13, fontWeight: "500" as const },
  /** Section headings and chip text - always paired with a muted colour. */
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8 },
} as const;

/** Shadows have to be set twice - iOS reads the shadow* keys, Android only reads
 *  elevation - so they live here rather than being half-remembered per component. */
export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export { light as lightTheme, dark as darkTheme, palette };
