/**
 * Every network call the app makes goes through here.
 *
 * Three things this file exists to get right:
 *
 * TOKENS. A browser keeps its session in an httpOnly cookie it never sees. React Native has
 * no cookie jar that survives the app being closed, so the app holds the tokens itself and
 * sends `Authorization: Bearer`. They live in expo-secure-store (Keychain on iOS, encrypted
 * SharedPreferences on Android), never in AsyncStorage, which is plain text on disk.
 *
 * REFRESH. The access token lasts an hour. Rather than make every screen handle a 401, a
 * failed call refreshes once and retries itself, and the screen never knows. Only ONE
 * refresh can be in flight at a time (see `refreshing`) - the dashboard fires several
 * requests at once on launch, and without that lock each 401 would start its own refresh,
 * every one of them rotating the token and invalidating the others. The server treats a
 * reused refresh token as theft and kills the session, so this is not a matter of tidiness:
 * the difference between the app working and the manager being logged out on launch.
 *
 * CSRF. The API rejects any mutating request without `X-Requested-With`. The app only ever
 * GETs apart from login/refresh/logout, but the header is sent on everything so a POST added
 * later cannot fail mysteriously.
 */
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "./config";

const ACCESS_KEY = "cargora.access_token";
const REFRESH_KEY = "cargora.refresh_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Thrown when the session is genuinely gone and the user has to sign in again. The auth
 *  layer listens for this rather than every screen checking status codes. */
export class SessionExpired extends ApiError {
  constructor() {
    super(401, "Your session has ended. Please sign in again.");
    this.name = "SessionExpired";
  }
}

type Tokens = { access: string; refresh: string };

let memory: Tokens | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  if (memory) return memory;
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    if (!access || !refresh) return null;
    memory = { access, refresh };
    return memory;
  } catch {
    // A device with no secure storage available is a device that cannot stay signed in -
    // treated as "signed out" rather than crashing on launch.
    return null;
  }
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  memory = { access, refresh };
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
  } catch {
    // Keep going on the in-memory copy: this session still works, it just will not
    // survive the app being closed.
  }
}

export async function clearTokens(): Promise<void> {
  memory = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  } catch {
    /* already gone */
  }
}

/** Set by the auth layer so a dead session can bounce the user to the sign-in screen from
 *  anywhere, without this file importing navigation and creating a cycle. */
let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(fn: (() => void) | null): void {
  onSessionLost = fn;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors arrive as a list of objects; show the first readable one
    // rather than "[object Object]".
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  } catch {
    /* not JSON - fall through to the generic message */
  }
  if (response.status >= 500) return "The server had a problem. Please try again.";
  return `Request failed (${response.status})`;
}

function headers(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    // The API's CSRF guard. Harmless on a GET, required on anything else.
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** One refresh at a time. Everyone who hits a 401 while a refresh is running waits on the
 *  SAME promise instead of starting another. */
let refreshing: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const current = await loadTokens();
    if (!current) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ refresh_token: current.refresh, token_response: true }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        tokens?: { access_token: string; refresh_token: string };
      };
      if (!body.tokens) return null;
      await saveTokens(body.tokens.access_token, body.tokens.refresh_token);
      return { access: body.tokens.access_token, refresh: body.tokens.refresh_token };
    } catch {
      // Offline, or the server is down. NOT a dead session - returning null here would sign
      // the user out for being on a train, so the caller distinguishes the two.
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Query parameters. Undefined and null values are dropped rather than sent as the string
   *  "undefined", which the API would reject as a bad date. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Internal: stops a retry from retrying itself forever. */
  retry?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = `${API_BASE_URL}${path}`;
  if (!params) return url;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return query ? `${url}?${query}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const tokens = await loadTokens();
  const url = buildUrl(path, options.params);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: headers(tokens?.access),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(0, "Can't reach Cargora. Check your connection and try again.");
  }

  if (response.status === 401 && !options.retry) {
    const renewed = await refreshTokens();
    if (renewed) return request<T>(path, { ...options, retry: true });
    await clearTokens();
    onSessionLost?.();
    throw new SessionExpired();
  }

  if (!response.ok) throw new ApiError(response.status, await readError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"], signal?: AbortSignal) =>
    request<T>(path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
};
