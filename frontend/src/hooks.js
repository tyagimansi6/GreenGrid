import { useCallback, useEffect, useState } from "react";

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · GreenGrid` : "GreenGrid";
  }, [title]);
}

export function usePoll(fetcher, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const reload = useCallback(async () => {
    try {
      const next = await fetcher();
      setData(next);
      setError("");
      setUpdatedAt(new Date());
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
