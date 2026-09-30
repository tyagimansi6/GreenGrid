import { useCallback, useEffect, useState } from "react";

const pollCache = new Map();

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · GreenGrid` : "GreenGrid";
  }, [title]);
}

export function usePoll(fetcher, intervalMs = 5000) {
  const seeded = pollCache.get(fetcher);
  const [data, setData] = useState(() => seeded?.data ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !seeded);
  const [updatedAt, setUpdatedAt] = useState(() => seeded?.updatedAt ?? null);

  const reload = useCallback(async () => {
    try {
      const next = await fetcher();
      const stamp = new Date();
      pollCache.set(fetcher, { data: next, updatedAt: stamp });
      setData(next);
      setError("");
      setUpdatedAt(stamp);
      return next;
    } catch (err) {
      setError(err.message || "Request failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    reload();
    const id = setInterval(reload, intervalMs);
    return () => clearInterval(id);
  }, [reload, intervalMs]);

  return { data, error, loading, updatedAt, reload };
}
