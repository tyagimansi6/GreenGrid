import { useCallback, useEffect, useId, useRef, useState } from "react";

const pollCache = new Map();
const flights = new Map();
const failures = new Map();
const retries = new Set();
const watchers = new Set();
let pending = 0;

function runShared(fetcher) {
  const current = flights.get(fetcher);
  if (current) return current;
  const job = Promise.resolve()
    .then(fetcher)
    .finally(() => {
      if (flights.get(fetcher) === job) flights.delete(fetcher);
    });
  flights.set(fetcher, job);
  return job;
}

function snapshot() {
  return {
    loading: pending > 0,
    error: failures.values().next().value || "",
  };
}

function notify() {
  const next = snapshot();
  watchers.forEach((listener) => listener(next));
}

export function useApiStatus() {
  const [status, setStatus] = useState(snapshot);
  useEffect(() => {
    watchers.add(setStatus);
    setStatus(snapshot());
    return () => watchers.delete(setStatus);
  }, []);
  return status;
}

export function retryAllPolls() {
  retries.forEach((retry) => retry());
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · GreenGrid` : "GreenGrid";
  }, [title]);
}

export function usePoll(fetcher, intervalMs = 5000) {
  const id = useId();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const cached = pollCache.get(fetcher);
  const [data, setData] = useState(() => cached?.data ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !cached);
  const [updatedAt, setUpdatedAt] = useState(() => cached?.updatedAt ?? null);
  const dataRef = useRef(cached?.data ?? null);
  const reloadRef = useRef(async () => null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let followedUp = false;

    async function tick(manual) {
      if (cancelled) return null;
      window.clearTimeout(timer);
      const fetcherNow = fetcherRef.current;
      const quiet = dataRef.current != null && !manual;
      let tracked = false;
      if (!quiet) {
        pending += 1;
        tracked = true;
        if (!dataRef.current && (manual || !followedUp)) setLoading(true);
        if (manual) {
          setError("");
          failures.delete(id);
        }
        notify();
      }
      try {
        const next = await runShared(fetcherNow);
        if (cancelled) return null;
        const stamp = new Date();
        dataRef.current = next;
        pollCache.set(fetcherNow, { data: next, updatedAt: stamp });
        setData(next);
        setError("");
        setUpdatedAt(stamp);
        failures.delete(id);
        followedUp = false;
        notify();
        timer = window.setTimeout(() => tick(false), intervalMs);
        return next;
      } catch (err) {
        if (cancelled) return null;
        const message = err?.message || "Request failed.";
        console.error("[greengrid] poll failed", message);
        setError(message);
        failures.set(id, message);
        notify();
        if (!manual && !followedUp) {
          followedUp = true;
          timer = window.setTimeout(() => tick(false), 15000);
        }
        return null;
      } finally {
        if (tracked) {
          pending = Math.max(0, pending - 1);
          notify();
        }
        if (!cancelled) setLoading(false);
      }
    }

    const kick = () => tick(true);
    reloadRef.current = kick;
    retries.add(kick);
    tick(false);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      retries.delete(kick);
      failures.delete(id);
      notify();
    };
  }, [id, intervalMs]);

  const reload = useCallback(() => reloadRef.current(), []);

  return { data, error, loading, updatedAt, reload };
}
