/**
 * One loading/error/data hook, used by every screen that fetches.
 *
 * It exists mainly for two things that are easy to get wrong separately on four screens:
 *
 * ABORT. Changing the date or the mode filter fires a new request while the last is still
 * running. Without aborting, a slow earlier response can land after a faster later one and
 * overwrite the screen with stale numbers - which on a dashboard looks exactly like a bug in
 * the data rather than in the app.
 *
 * REFRESH vs LOAD. Pull-to-refresh must not blank the screen it is refreshing. `loading` is
 * the first load only; `refreshing` is every one after.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
};

export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): State<T> & { reload: () => void; refresh: () => void } {
  const [state, setState] = useState<State<T>>({
    data: null, error: null, loading: true, refreshing: false,
  });
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  // Kept in a ref so `run` does not change identity whenever the caller passes a new inline
  // closure, which would restart the effect on every render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(async (mode: "load" | "refresh") => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;

    setState((s) => ({
      ...s,
      error: null,
      loading: mode === "load" ? true : s.loading,
      refreshing: mode === "refresh",
    }));

    try {
      const data = await fnRef.current(own.signal);
      if (!mounted.current || own.signal.aborted) return;
      setState({ data, error: null, loading: false, refreshing: false });
    } catch (e) {
      // An abort is this hook replacing its own request, not a failure to report.
      if (own.signal.aborted || (e as Error)?.name === "AbortError") return;
      if (!mounted.current) return;
      setState((s) => ({
        // The previous data is kept on screen behind the error: stale numbers with a visible
        // "couldn't refresh" beat an empty screen when a train goes through a tunnel.
        data: s.data,
        error: (e as Error).message || "Something went wrong.",
        loading: false,
        refreshing: false,
      }));
    }
  }, []);

  useEffect(() => {
    void run("load");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...state,
    reload: () => void run("load"),
    refresh: () => void run("refresh"),
  };
}
