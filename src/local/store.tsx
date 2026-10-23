import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  localApi,
  type LocalSnapshot,
  type LocalJam,
  type Organizer,
} from "./types";
type Draft = { value: unknown; revision: number; blocked?: boolean };
type Snapshot = {
  data: Record<string, unknown>;
  revisions: Record<string, number>;
  drafts: Record<string, Draft>;
};
type LocalContextValue = {
  jam: LocalJam;
  user: Organizer;
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  pending: number;
  error: string;
  busy: boolean;
  lastSync: string;
  discard: () => Promise<void>;
  download: () => void;
  logout: () => Promise<void>;
  editSetup: () => void;
};
const Context = createContext<LocalContextValue | null>(null);
export const useLocalEvent = () => useContext(Context);
const stringify = (value: unknown) => JSON.stringify(value);
export function LocalProvider({
  initial,
  children,
  onLogout,
  onEdit,
}: {
  initial: LocalSnapshot;
  children: ReactNode;
  onLogout: () => Promise<void>;
  onEdit: (jam: LocalJam) => void;
}) {
  const key = `gj-local:${initial.user.id}:${initial.jam.id}`;
  const initialData = (): Snapshot => {
    let drafts: Snapshot["drafts"] = {};
    try {
      drafts = JSON.parse(localStorage.getItem(key) || "null")?.drafts || {};
    } catch {}
    const data = Object.fromEntries(initial.state.map((r) => [r.key, r.value]));
    for (const [k, draft] of Object.entries(drafts)) data[k] = draft.value;
    return {
      data,
      revisions: Object.fromEntries(
        initial.state.map((r) => [r.key, r.revision]),
      ),
      drafts,
    };
  };
  const [snapshot, setSnapshot] = useState(initialData);
  const ref = useRef(snapshot);
  const [jam, setJam] = useState(initial.jam);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const locked = useRef(false);
  const disposed = useRef(false);
  function commit(next: Snapshot) {
    if (disposed.current) return;
    ref.current = next;
    localStorage.setItem(key, stringify(next));
    setSnapshot(next);
  }
  async function refresh() {
    const result = await localApi<LocalSnapshot>(`jams/${initial.jam.id}`);
    if (disposed.current) return;
    const data = Object.fromEntries(result.state.map((r) => [r.key, r.value]));
    const drafts = ref.current.drafts;
    for (const [k, d] of Object.entries(drafts)) data[k] = d.value;
    for (const k of Object.keys(data))
      if (stringify(data[k]) === stringify(ref.current.data[k]))
        data[k] = ref.current.data[k];
    commit({
      data,
      revisions: Object.fromEntries(
        result.state.map((r) => [r.key, r.revision]),
      ),
      drafts,
    });
    setJam(result.jam);
    setLastSync(
      new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  async function sync() {
    if (locked.current || !navigator.onLine || disposed.current) return;
    locked.current = true;
    setBusy(true);
    try {
      for (const [k, draft] of Object.entries(ref.current.drafts)) {
        if (draft.blocked) continue;
        let result: { revision: number };
        try {
          result = await localApi(
            `jams/${initial.jam.id}/state/${encodeURIComponent(k)}`,
            {
              method: "PUT",
              body: stringify({ value: draft.value, revision: draft.revision }),
            },
          );
        } catch (e) {
          if ((e as { status?: number }).status === 409) {
            const current = ref.current;
            commit({
              ...current,
              drafts: {
                ...current.drafts,
                [k]: { ...current.drafts[k], blocked: true },
              },
            });
          }
          throw e;
        }
        const current = ref.current;
        const drafts = { ...current.drafts };
        if (stringify(drafts[k]?.value) === stringify(draft.value))
          delete drafts[k];
        else drafts[k] = { ...drafts[k], revision: result.revision };
        commit({
          ...current,
          revisions: { ...current.revisions, [k]: result.revision },
          drafts,
        });
      }
      await refresh();
      setError(
        Object.values(ref.current.drafts).some((d) => d.blocked)
          ? "Hay cambios en conflicto. Descarga tu borrador antes de recuperar la versión guardada."
          : "",
      );
    } catch (e) {
      if (!disposed.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo sincronizar. El borrador permanece en este dispositivo.",
        );
    } finally {
      locked.current = false;
      if (!disposed.current) setBusy(false);
    }
  }
  useEffect(() => {
    disposed.current = false;
    void sync();
    const listener = () => void sync();
    const timer = setInterval(listener, 5000);
    window.addEventListener("online", listener);
    window.addEventListener("gj-local-sync", listener);
    return () => {
      disposed.current = true;
      clearInterval(timer);
      window.removeEventListener("online", listener);
      window.removeEventListener("gj-local-sync", listener);
    };
  }, [key]);
  function set(k: string, value: unknown) {
    const current = ref.current;
    commit({
      data: { ...current.data, [k]: value },
      revisions: current.revisions,
      drafts: {
        ...current.drafts,
        [k]: {
          value,
          revision: current.drafts[k]?.revision ?? current.revisions[k] ?? 0,
          blocked: current.drafts[k]?.blocked,
        },
      },
    });
    setTimeout(() => window.dispatchEvent(new Event("gj-local-sync")), 400);
  }
  function download() {
    const blob = new Blob([stringify(ref.current)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "borrador-jam.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function discard() {
    if (locked.current) {
      setError("Espera a que termine la sincronización antes de recargar.");
      return;
    }
    commit({ ...ref.current, drafts: {} });
    try {
      await refresh();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function logout() {
    if (
      Object.keys(ref.current.drafts).length &&
      !confirm(
        "Hay cambios pendientes. Cancela y descarga el borrador antes de salir. ¿Salir y descartar esos cambios locales?",
      )
    )
      return;
    await onLogout();
    localStorage.removeItem(key);
  }
  return (
    <Context.Provider
      value={{
        jam,
        user: initial.user,
        data: snapshot.data,
        set,
        pending: Object.keys(snapshot.drafts).length,
        error,
        busy,
        lastSync,
        discard,
        download,
        logout,
        editSetup: () => onEdit(jam),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocalValue<T>(key: string, initial: T) {
  const context = useLocalEvent();
  const value = (context?.data[key] ??
    (context && Array.isArray(initial) ? [] : initial)) as T;
  return [
    value,
    (next: SetStateAction<T>) =>
      context?.set(
        key,
        typeof next === "function" ? (next as (old: T) => T)(value) : next,
      ),
  ] as const;
}
