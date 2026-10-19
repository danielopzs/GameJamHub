import { useCloud, useCloudValue } from "./cloud/store";
import { STATIC_MODE } from "./runtime";
import { useEffect, useState, type SetStateAction } from "react";
/** Local-first state: pending writes survive offline sessions; reconnect flushes them to SQLite. */
function useLegacyLocal<T>(key: string, initial: T) {
  const cloud = useCloud();
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (!cloud && localStorage.getItem(key) === null)
      localStorage.setItem(key, JSON.stringify(initial));
  }, [key]);
  useEffect(() => {
    if (cloud || key === "gj-dark" || STATIC_MODE) return;
    let disposed = false,
      busy = false;
    const sync = async () => {
      if (!navigator.onLine || busy) return;
      busy = true;
      try {
        const pendingKey = key + ":pending";
        const pending = localStorage.getItem(pendingKey);
        if (pending) {
          const snapshot = localStorage.getItem(key) || "null";
          const response = await fetch("/api/state/" + key, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: JSON.parse(snapshot) }),
          });
          if (response.ok && localStorage.getItem(key) === snapshot)
            localStorage.removeItem(pendingKey);
        } else {
          const snapshot = localStorage.getItem(key);
          const response = await fetch("/api/state/" + key);
          if (!response.ok) return;
          const data = await response.json();
          if (
            disposed ||
            localStorage.getItem(pendingKey) ||
            localStorage.getItem(key) !== snapshot
          )
            return;
          if (data.value !== null) {
            const serialized = JSON.stringify(data.value);
            if (serialized !== snapshot) {
              localStorage.setItem(key, serialized);
              setValue(data.value);
            }
          } else {
            const r = await fetch("/api/state/" + key, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value: JSON.parse(snapshot || "null") }),
            });
            if (!r.ok) localStorage.setItem(pendingKey, "1");
          }
        }
      } catch {
        /* Offline state remains queued locally. */
      } finally {
        busy = false;
      }
    };
    void sync();
    const timer = setInterval(sync, 5000);
    window.addEventListener("online", sync);
    window.addEventListener("gj-sync", sync);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("gj-sync", sync);
    };
  }, [key]);
  const set = (next: SetStateAction<T>) =>
    setValue((current) => {
      const result =
        typeof next === "function" ? (next as (old: T) => T)(current) : next;
      localStorage.setItem(key, JSON.stringify(result));
      if (key !== "gj-dark" && !STATIC_MODE)
        localStorage.setItem(key + ":pending", "1");
      setTimeout(() => window.dispatchEvent(new Event("gj-sync")), 0);
      return result;
    });
  return [value, set] as const;
}

export function useLocal<T>(key: string, initial: T) {
  const cloud = useCloud();
  const local = useLegacyLocal(key, initial);
  const remote = useCloudValue(key, initial);
  return cloud && key !== "gj-dark" ? remote : local;
}
