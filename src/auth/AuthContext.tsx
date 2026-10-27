/**
 * Who is signed in, what they may see, and what they have chosen to see.
 *
 * Those last two are different things and the distinction is the whole security model:
 *
 *   identity.allowed_modes   the SERVER's limit. Set by a Super Admin when the login is
 *                            issued. The phone cannot change it and never sends it back.
 *   selectedModes            this PHONE's preference, picked by whoever holds it. It can
 *                            only ever narrow what the server already allows - and the
 *                            server intersects it again on arrival, so a tampered app
 *                            still sees nothing extra.
 *
 * The preference lives in AsyncStorage, which is per DEVICE. That is the whole point: one
 * company normally has ONE app login that several managers share, and each of them picks
 * what they want on their own phone. Same login, same allowed_modes, different default on
 * every handset - the sea-freight manager sees Sea Import, the air-freight manager sees Air
 * Import, and neither changes anything for the other.
 *
 * It is keyed by user id as well, so that two different logins used on one handset do not
 * inherit each other's filters.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

import { API_BASE_URL } from "../api/config";
import {
  ApiError, clearTokens, loadTokens, saveTokens, setSessionLostHandler,
} from "../api/client";
import { AppIdentity, managerApi } from "../api/manager";

type Status = "loading" | "signedOut" | "signedIn";

type AuthValue = {
  status: Status;
  identity: AppIdentity | null;
  /** The modes actually in force on THIS phone: the chosen subset, or every allowed mode
   *  when nothing has been chosen yet. Screens use this and never reason about the empty
   *  case themselves. */
  activeModes: string[];
  /** What the user ticked. Empty means "not chosen yet", which is why it is separate from
   *  activeModes above. */
  selectedModes: string[];
  /** False until the user has been through the mode picker once. */
  hasChosenModes: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setModes: (modes: string[]) => Promise<void>;
  /** Re-reads /me, so a change an administrator makes to the allowed modes lands on the
   *  phone without a reinstall. */
  refreshIdentity: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const modesKey = (userId: string) => `cargora.modes.${userId}`;

/**
 * What a phone remembers about its owner's choice.
 *
 * `chosen` is stored SEPARATELY from `modes` and that separation is the point. An empty
 * `modes` means "everything this login allows" - which is both the commonest answer and,
 * stored on its own, indistinguishable from never having answered. Deriving "have they
 * chosen?" from the list's length made picking every type bounce straight back to the
 * picker, forever, because an empty list read as "not chosen yet".
 */
type StoredModePref = { chosen: boolean; modes: string[] };

/** Accepts the older plain-array format too, so a phone that saved a preference before this
 *  shape existed keeps it instead of being sent back to the picker. */
function parseModePref(raw: string | null): StoredModePref {
  if (!raw) return { chosen: false, modes: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      // Legacy: a bare list. A non-empty one was definitely a real choice; an empty one is
      // ambiguous, so it is treated as unanswered and the picker asks once more.
      return { chosen: parsed.length > 0, modes: parsed as string[] };
    }
    if (parsed && typeof parsed === "object" && "chosen" in parsed) {
      const pref = parsed as StoredModePref;
      return { chosen: !!pref.chosen, modes: Array.isArray(pref.modes) ? pref.modes : [] };
    }
  } catch {
    /* unreadable - fall through to "not chosen" */
  }
  return { chosen: false, modes: [] };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [identity, setIdentity] = useState<AppIdentity | null>(null);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [hasChosenModes, setHasChosenModes] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadModePreference = useCallback(async (who: AppIdentity) => {
    let pref: StoredModePref = { chosen: false, modes: [] };
    try {
      pref = parseModePref(await AsyncStorage.getItem(modesKey(who.user_id)));
    } catch {
      // A preference is a convenience. Losing it means the picker shows again, which is a
      // far better outcome than failing to start.
      pref = { chosen: false, modes: [] };
    }
    // Drop anything this login is no longer allowed - an administrator may have narrowed it
    // since the choice was made, and a stale tick must not survive that.
    const valid = pref.modes.filter((m) => who.allowed_modes.includes(m));
    if (!mounted.current) return;
    setSelectedModes(valid);
    setHasChosenModes(pref.chosen);
    if (valid.length !== pref.modes.length) {
      try {
        await AsyncStorage.setItem(
          modesKey(who.user_id),
          JSON.stringify({ chosen: pref.chosen, modes: valid } satisfies StoredModePref),
        );
      } catch { /* best effort */ }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const tokens = await loadTokens();
    if (!tokens) {
      if (mounted.current) setStatus("signedOut");
      return;
    }
    try {
      const who = await managerApi.me();
      if (!mounted.current) return;
      setIdentity(who);
      await loadModePreference(who);
      if (mounted.current) setStatus("signedIn");
    } catch (error) {
      // Offline on launch is NOT a reason to sign someone out - their token may be perfectly
      // good. Only an actual rejection by the server is.
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 401 || status === 403) {
        await clearTokens();
        if (mounted.current) setStatus("signedOut");
      } else if (mounted.current) {
        setStatus("signedOut");
      }
    }
  }, [loadModePreference]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  // Lets the API layer push the app back to the sign-in screen when a refresh finally fails,
  // without the client importing this module and creating a cycle.
  useEffect(() => {
    setSessionLostHandler(() => {
      if (!mounted.current) return;
      setIdentity(null);
      setSelectedModes([]);
      setHasChosenModes(false);
      setStatus("signedOut");
    });
    return () => setSessionLostHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      // token_response is what makes the server hand back the pair in the body instead of
      // relying on cookies this app cannot keep.
      body: JSON.stringify({ email: email.trim(), password, token_response: true }),
    }).catch(() => {
      throw new ApiError(0, "Can't reach Cargora. Check your connection and try again.");
    });

    if (!response.ok) {
      let message = "Sign in failed. Please try again.";
      if (response.status === 401) message = "That email or password is not right.";
      else {
        try {
          const body = await response.json();
          if (typeof body?.detail === "string") message = body.detail;
        } catch { /* keep the generic message */ }
      }
      throw new ApiError(response.status, message);
    }

    const body = (await response.json()) as {
      tokens?: { access_token: string; refresh_token: string };
      user?: { role?: string };
    };
    if (!body.tokens) {
      throw new ApiError(500, "The server did not return a session. Please tell support.");
    }
    await saveTokens(body.tokens.access_token, body.tokens.refresh_token);

    // Said here rather than letting /me fail with a bare 403: an operator typing their own
    // perfectly valid password deserves to know WHY this app will not let them in.
    if (body.user?.role && body.user.role !== "app_manager") {
      await clearTokens();
      throw new ApiError(
        403,
        "This app is for manager logins. Your account signs in on the Cargora website instead.",
      );
    }

    const who = await managerApi.me();
    if (!mounted.current) return;
    setIdentity(who);
    await loadModePreference(who);
    if (mounted.current) setStatus("signedIn");
  }, [loadModePreference]);

  const signOut = useCallback(async () => {
    const tokens = await loadTokens();
    if (tokens) {
      // Best effort: tell the server to revoke the session too, so the refresh token dies
      // now rather than when it happens to expire.
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ refresh_token: tokens.refresh }),
        });
      } catch { /* signing out locally still has to work offline */ }
    }
    await clearTokens();
    if (!mounted.current) return;
    setIdentity(null);
    setSelectedModes([]);
    setHasChosenModes(false);
    setStatus("signedOut");
  }, []);

  const setModes = useCallback(async (modes: string[]) => {
    if (!identity) return;
    // Belt and braces: filter against what the server allows before storing, so a bug here
    // cannot persist a mode this login may not see.
    const valid = modes.filter((m) => identity.allowed_modes.includes(m));
    setSelectedModes(valid);
    // Reaching this function at all IS the choice - including choosing everything, which
    // stores an empty list. Anything derived from the list's length instead would make that
    // case look unanswered and bounce the user back to the picker.
    setHasChosenModes(true);
    try {
      await AsyncStorage.setItem(
        modesKey(identity.user_id),
        JSON.stringify({ chosen: true, modes: valid } satisfies StoredModePref),
      );
    } catch { /* the choice still applies to this session */ }
  }, [identity]);

  const refreshIdentity = useCallback(async () => {
    if (!identity) return;
    try {
      const who = await managerApi.me();
      if (!mounted.current) return;
      setIdentity(who);
      await loadModePreference(who);
    } catch { /* keep what we have */ }
  }, [identity, loadModePreference]);

  const activeModes = useMemo(() => {
    if (!identity) return [];
    return selectedModes.length ? selectedModes : identity.allowed_modes;
  }, [identity, selectedModes]);

  const value = useMemo<AuthValue>(() => ({
    status, identity, activeModes, selectedModes, hasChosenModes,
    signIn, signOut, setModes, refreshIdentity,
  }), [status, identity, activeModes, selectedModes, hasChosenModes,
       signIn, signOut, setModes, refreshIdentity]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
