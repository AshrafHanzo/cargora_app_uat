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
 * The preference is per login, keyed by user id, so two accounts on one handset do not
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
  /** The modes actually in force: the chosen subset, or every allowed mode when nothing has
   *  been chosen yet. Screens use this and never reason about the empty case themselves. */
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [identity, setIdentity] = useState<AppIdentity | null>(null);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [hasChosenModes, setHasChosenModes] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadModePreference = useCallback(async (who: AppIdentity) => {
    let stored: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(modesKey(who.user_id));
      if (raw) stored = JSON.parse(raw) as string[];
    } catch {
      // A preference is a convenience. Losing it means the picker shows again, which is a
      // far better outcome than failing to start.
      stored = [];
    }
    // Drop anything this login is no longer allowed - an administrator may have narrowed it
    // since the choice was made, and a stale tick must not survive that.
    const valid = stored.filter((m) => who.allowed_modes.includes(m));
    if (!mounted.current) return;
    setSelectedModes(valid);
    setHasChosenModes(valid.length > 0);
    if (valid.length !== stored.length) {
      try {
        await AsyncStorage.setItem(modesKey(who.user_id), JSON.stringify(valid));
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
    setHasChosenModes(valid.length > 0);
    try {
      await AsyncStorage.setItem(modesKey(identity.user_id), JSON.stringify(valid));
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
