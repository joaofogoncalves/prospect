import { useCallback, useEffect, useState } from "react";

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// Minimal async data hook: tracks loading/error/data and exposes `reload`.
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // `fn` is intentionally re-created per render by callers; we key on `deps`.
  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Request failed",
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { ...state, reload: run };
}
