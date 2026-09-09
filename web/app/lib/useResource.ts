"use client";
import { useEffect, useState } from "react";

/** Abort stale requests, retain data only for the same URL, and distinguish errors from empty data. */
export function useResource<T>(url: string | null) {
  const [revision, setRevision] = useState(0);
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<{ key: string; url: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let live = true;
    const timeout = setTimeout(() => controller.abort(), 30000);
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Sign in to continue." : "This data is unavailable. Check your connection and try again.");
        const data = await response.json();
        if (data?.error) throw new Error("This data could not be loaded. Check Settings & data, then try again.");
        if (live) setResult({ key, url, data, error: null });
      })
      .catch(error => { if (live) setResult({ key, url, data: null, error: error.name === "AbortError" ? "The request timed out. Please try again." : error.message }); })
      .finally(() => clearTimeout(timeout));
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [url, key]);
  return {
    data: result?.url === url ? result.data : null,
    loading: Boolean(url && result?.key !== key),
    error: result?.key === key ? result.error : null,
    reload: () => setRevision(value => value + 1),
  };
}
