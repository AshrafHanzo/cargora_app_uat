/**
 * A ship, a plane, a lorry or a train, and which way it is going.
 *
 * Drawn as SVG rather than emoji: emoji render differently on every Android skin and are
 * wildly inconsistent in size, which on a grid of four cards is immediately obvious. These
 * also take the mode's own colour, so the icon, the card's accent and the chart legend are
 * the same hue without anyone having to remember to keep them in step.
 *
 * The small arrow is the import/export direction - without it a Sea Import card and a Sea
 * Export card are the same picture, and those are the two numbers most worth not confusing.
 */
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

import { modeColor } from "../theme";

function Ship({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* hull */}
      <Path
        d="M3 16.5h18l-1.6 3.2a2 2 0 0 1-1.8 1.1H6.4a2 2 0 0 1-1.8-1.1L3 16.5Z"
        fill={color}
      />
      {/* containers */}
      <Path d="M6 16.5V12h5v4.5" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M13 16.5V9.5h5v7" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function Plane({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 14.5 13.6 12 12 3.8a1 1 0 0 0-2 0L8.4 12 1 14.5v1.7l7.6-2 .7 3.6-2.1 1.5v1.4l3.8-1 3.8 1v-1.4l-2.1-1.5.7-3.6 7.6 2v-1.7Z"
        fill={color}
      />
    </Svg>
  );
}

function Truck({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 7h11v9H2z" fill={color} />
      <Path d="M13 10h4.2l2.8 3.2V16h-7v-6Z" fill={color} opacity={0.75} />
      <Circle cx="7" cy="18" r="2" fill={color} />
      <Circle cx="17" cy="18" r="2" fill={color} />
    </Svg>
  );
}

function Train({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h12a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" fill={color} />
      <Path d="M7 6.5h10v4H7z" fill="#FFFFFF" opacity={0.9} />
      <Path d="M7.5 20.5 5 23M16.5 20.5 19 23" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** ↓ into the country, ↑ out of it. */
function Direction({ color, size, isImport }: { color: string; size: number; isImport: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={isImport ? "M12 4v14m0 0-5-5m5 5 5-5" : "M12 20V6m0 0-5 5m5-5 5 5"}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ModeIcon({ mode, size = 22 }: { mode: string; size?: number }) {
  const color = modeColor(mode);
  const lower = mode.toLowerCase();
  const isImport = lower.includes("import");

  const Vehicle = lower.includes("sea")
    ? Ship
    : lower.includes("air")
      ? Plane
      : lower.includes("train")
        ? Train
        : Truck;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Vehicle color={color} size={size} />
      {/* Nested so the arrow scales with the icon rather than being positioned absolutely,
          which drifts at different sizes. */}
      <Svg x={14} y={0} width={10} height={10} viewBox="0 0 24 24">
        <Direction color={color} size={10} isImport={isImport} />
      </Svg>
    </Svg>
  );
}
