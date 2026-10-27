/**
 * The Manager app's endpoints, typed.
 *
 * These mirror app/schemas/manager_app.py in the backend one-for-one. Every one is a GET -
 * there is nothing to write here, by design, because a manager watches and never acts.
 *
 * `tz_offset` is sent on every call that counts by day. The server stores finish times in
 * UTC, and "completed on the 15th" means the 15th where the manager is standing: a job
 * finished at 02:00 IST is 20:30 UTC the day BEFORE, and without this it would be reported
 * on the wrong day.
 */
import { api } from "./client";

export type AppIdentity = {
  user_id: string;
  email: string;
  full_name: string | null;
  tenant_id: string;
  company_name: string | null;
  /** What this login is ALLOWED to see. The mode picker offers exactly these. */
  allowed_modes: string[];
};

export type ModeCount = {
  mode: string;
  completed: number;
  previous: number | null;
  /** Null means "nothing to compare against" - show "no comparison", never "0%". */
  change_pct: number | null;
};

export type UserCount = {
  user_id: string | null;
  name: string;
  completed: number;
  share_pct: number;
};

export type Dashboard = {
  date: string;
  completed: number;
  previous_date: string;
  previous_completed: number;
  change_pct: number | null;
  by_mode: ModeCount[];
  top_users: UserCount[];
  modes: string[];
};

export type TrendPoint = { date: string; completed: number };
export type Trend = { points: TrendPoint[]; total: number; modes: string[] };

export type Usage = {
  start: string;
  end: string;
  completed: number;
  previous_completed: number;
  change_pct: number | null;
  users: UserCount[];
  by_mode: ModeCount[];
  modes: string[];
};

export type ReportRow = {
  job_id: string;
  reference: string;
  mode: string | null;
  customer_name: string | null;
  operator_name: string | null;
  completed_at: string;
};

export type Report = {
  start: string;
  end: string;
  total: number;
  rows: ReportRow[];
  modes: string[];
};

/** The device's own offset from UTC, in minutes east - the opposite sign to what
 *  getTimezoneOffset() returns, which counts westward. */
export function deviceTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

/** The API takes modes as one comma-separated value. Undefined (not an empty string) means
 *  "everything this login may see" - an empty string would be sent as a real parameter and
 *  read as "no modes at all". */
function modeParam(modes: string[] | undefined): string | undefined {
  if (!modes || modes.length === 0) return undefined;
  return modes.join(",");
}

/** YYYY-MM-DD in the DEVICE's own calendar. toISOString() is always UTC, which in India is
 *  the previous day until 05:30 - the exact bug this app exists to fix, so it is never used
 *  for a date the user sees or sends. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const managerApi = {
  me: (signal?: AbortSignal) => api.get<AppIdentity>("/manager-app/me", undefined, signal),

  dashboard: (date: string, modes?: string[], signal?: AbortSignal) =>
    api.get<Dashboard>(
      "/manager-app/dashboard",
      { date, modes: modeParam(modes), tz_offset: deviceTzOffset() },
      signal,
    ),

  trend: (days: number, end: string, modes?: string[], signal?: AbortSignal) =>
    api.get<Trend>(
      "/manager-app/trend",
      { days, end, modes: modeParam(modes), tz_offset: deviceTzOffset() },
      signal,
    ),

  usage: (start: string, end: string, modes?: string[], signal?: AbortSignal) =>
    api.get<Usage>(
      "/manager-app/usage",
      { start, end, modes: modeParam(modes), tz_offset: deviceTzOffset() },
      signal,
    ),

  reports: (start: string, end: string, modes?: string[], signal?: AbortSignal) =>
    api.get<Report>(
      "/manager-app/reports",
      { start, end, modes: modeParam(modes), tz_offset: deviceTzOffset() },
      signal,
    ),
};
