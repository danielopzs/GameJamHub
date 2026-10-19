import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";
import type {
  CloudEvent,
  AccessMember,
  Dataset,
  RankingRow,
  Snapshot,
} from "./types";

type Context = {
  event: CloudEvent;
  user: User;
  organizer: boolean;
  canEvaluate: boolean;
  actor: string;
  members: AccessMember[];
  ranking: RankingRow[];
  snapshot: Snapshot;
  set: (key: string, value: unknown) => void;
  refresh: () => Promise<void>;
  error: string;
  pending: number;
  busy: boolean;
  lastSync: string;
  invite: (email: string, name: string, role: string) => Promise<void>;
  remove: (email: string) => Promise<void>;
  discard: () => Promise<void>;
};
const CloudContext = createContext<Context | null>(null);
export const useCloud = () => useContext(CloudContext);
const json = (v: unknown) => JSON.stringify(v);
export function CloudProvider({
  event,
  user,
  children,
  onBack,
}: {
  event: CloudEvent;
  user: User;
  children: ReactNode;
  onBack: () => void;
}) {
  const cacheKey = `gj-cloud:${user.id}:${event.id}`;
  const initial = (): Snapshot => {
    try {
      return (
        JSON.parse(localStorage.getItem(cacheKey) || "null") || {
          data: {},
          revisions: {},
          drafts: {},
        }
      );
    } catch {
      return { data: {}, revisions: {}, drafts: {} };
    }
  };

  const [snapshot, setSnapshot] = useState(initial);
  const ref = useRef(snapshot);
  const [members, setMembers] = useState<AccessMember[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey + ":members") || "[]");
    } catch {
      return [];
    }
  });
  const [ranking, setRanking] = useState<RankingRow[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey + ":ranking") || "[]");
    } catch {
      return [];
    }
  });
  const [error, setError] = useState("");
  const [ready, setReady] = useState(!!snapshot.data["gj-event"]);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const mutex = useRef(false);
  const disposed = useRef(false);
  const lastRevision = useRef<number | null>(null);
  const actor = (user.email || "").toLowerCase();
  const organizer =
    event.owner_id === user.id ||
    members.some((m) => m.email === actor && m.role === "organizer");
  const canEvaluate = members.some(
    (m) => m.email === actor && m.role === "judge",
  );
  function commit(next: Snapshot) {
    if (disposed.current) return;
    ref.current = next;
    localStorage.setItem(cacheKey, json(next));
    if (!disposed.current) setSnapshot(next);
  }
  async function refresh() {
    const client = supabase!;
    const version = await client
      .from("jam_events")
      .select("revision")
      .eq("id", event.id)
      .single();
    if (version.error) throw version.error;
    const revision = Number(version.data.revision);
    if (
      lastRevision.current === revision &&
      Object.keys(ref.current.drafts).length === 0
    )
      return;

    const [states, access, ratings, rank] = await Promise.all([
      client
        .from("jam_state")
        .select("key,value,revision")
        .eq("event_id", event.id),
      client
        .from("jam_members")
        .select("email,name,role")
        .eq("event_id", event.id),
      client
        .from("jam_evaluations")
        .select("judge_email,team_code,scores")
        .eq("event_id", event.id),
      client.rpc("jam_ranking", { p_event: event.id }),
    ]);
    for (const result of [states, access, ratings, rank])
      if (result.error) throw result.error;
    if (disposed.current) return;
    const data: Dataset = {};
    const revisions: Record<string, number> = {};
    for (const row of states.data || []) {
      data[row.key] = row.value;
      revisions[row.key] = row.revision;
    }
    data["gj-judges"] = (access.data || [])
      .filter((m) => m.role === "judge")
      .map((m) => m.email);
    data["gj-evaluations"] = Object.fromEntries(
      (ratings.data || []).map((r) => [
        `${r.judge_email}:${r.team_code}`,
        r.scores,
      ]),
    );
    const drafts = ref.current.drafts;
    for (const [key, draft] of Object.entries(drafts)) {
      if (key === "gj-evaluations")
        data[key] = {
          ...((data[key] as object) || {}),
          ...(draft.value as object),
        };
      else data[key] = draft.value;
    }
    for (const key of Object.keys(data)) {
      if (json(data[key]) === json(ref.current.data[key]))
        data[key] = ref.current.data[key];
    }
    commit({ data, revisions, drafts });
    localStorage.setItem(cacheKey + ":members", json(access.data || []));
    setMembers((access.data || []) as AccessMember[]);
    setRanking((rank.data || []) as RankingRow[]);
    localStorage.setItem(cacheKey + ":ranking", json(rank.data || []));
    setReady(true);
    lastRevision.current = revision;
    setLastSync(
      new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  async function sync() {
    if (mutex.current || !navigator.onLine) return;
    mutex.current = true;
    setBusy(true);
    try {
      for (const [key, draft] of Object.entries(ref.current.drafts)) {
        if (draft.blocked) continue;
        if (key === "gj-evaluations") {
          for (const [identity, scores] of Object.entries(
            draft.value as Record<string, number[]>,
          )) {
            const prefix = actor + ":";
            if (!identity.startsWith(prefix))
              throw Error("Solo puedes guardar tus propias evaluaciones.");
            const { error } = await supabase!.rpc("jam_save_evaluation", {
              p_event: event.id,
              p_team: identity.slice(prefix.length),
              p_scores: scores,
            });
            if (error) throw error;
          }
        } else {
          const { data, error } = await supabase!.rpc("jam_save_state", {
            p_event: event.id,
            p_key: key,
            p_value: draft.value,
            p_revision: draft.revision,
          });
          if (error) {
            if (error.code === "40001") {
              const current = ref.current;
              commit({
                ...current,
                drafts: {
                  ...current.drafts,
                  [key]: { ...current.drafts[key], blocked: true },
                },
              });
            }
            throw error;
          }
          const current = ref.current;
          const same = json(current.drafts[key]?.value) === json(draft.value);
          const nextDrafts = { ...current.drafts };
          if (same) delete nextDrafts[key];
          else nextDrafts[key] = { ...nextDrafts[key], revision: data };
          commit({
            ...current,
            revisions: { ...current.revisions, [key]: data },
            drafts: nextDrafts,
          });
          continue;
        }
        const current = ref.current;
        if (json(current.drafts[key]?.value) === json(draft.value)) {
          const remaining = { ...current.drafts };
          delete remaining[key];
          commit({ ...current, drafts: remaining });
        }
      }
      await refresh();
      setError(
        Object.values(ref.current.drafts).some((d) => d.blocked)
          ? "CONFLICT: conserva o descarga tu borrador y recarga la versión del servidor antes de continuar."
          : "",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ||
              "No se pudo sincronizar. Tu borrador sigue en este dispositivo.",
      );
    } finally {
      mutex.current = false;
      if (!disposed.current) setBusy(false);
    }
  }
  useEffect(() => {
    disposed.current = false;
    void sync();
    const poll = () => {
      if (document.visibilityState !== "hidden") void sync();
    };
    const timer = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", sync);
    const wake = () => void sync();
    window.addEventListener("gj-cloud-sync", wake);
    return () => {
      disposed.current = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", sync);
      window.removeEventListener("gj-cloud-sync", wake);
    };
  }, [event.id, user.id]);
  function set(key: string, value: unknown) {
    if (key === "gj-judges") {
      setError("Asigna los jueces por correo desde Accesos del evento.");
      return;
    }
    if (key === "gj-evaluations") {
      if (!canEvaluate) {
        setError("Tu cuenta no está asignada como juez en este evento.");
        return;
      }
      const before = (ref.current.data[key] as Record<string, unknown>) || {};
      const changes = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(
          ([k, v]) => k.startsWith(actor + ":") && json(v) !== json(before[k]),
        ),
      );
      value = {
        ...((ref.current.drafts[key]?.value as object) || {}),
        ...changes,
      };
    } else if (!organizer) {
      setError("Solo el comité organizador puede modificar estos datos.");
      return;
    }
    const current = ref.current;
    const next = {
      data: {
        ...current.data,
        [key]:
          key === "gj-evaluations"
            ? { ...((current.data[key] as object) || {}), ...(value as object) }
            : value,
      },
      revisions: current.revisions,
      drafts: {
        ...current.drafts,
        [key]: {
          value,
          revision:
            current.drafts[key]?.revision ?? current.revisions[key] ?? 0,
          blocked: current.drafts[key]?.blocked,
        },
      },
    };
    commit(next);
    setTimeout(() => window.dispatchEvent(new Event("gj-cloud-sync")), 600);
  }
  async function invite(email: string, name: string, role: string) {
    const { error } = await supabase!.rpc("jam_set_member", {
      p_event: event.id,
      p_email: email,
      p_name: name,
      p_role: role,
    });
    if (error) throw error;
    await refresh();
  }
  async function remove(email: string) {
    const { error } = await supabase!.rpc("jam_remove_member", {
      p_event: event.id,
      p_email: email,
    });
    if (error) throw error;
    await refresh();
  }
  async function discard() {
    commit({ ...ref.current, drafts: {} });
    lastRevision.current = null;
    await refresh();
    setError("");
  }
  if (!ready)
    return (
      <div className="cloud-screen">
        <div className="panel cloud-card">
          <h2>
            {error ? "No se pudo abrir el evento" : "Conectando con Supabase…"}
          </h2>
          <p>{error || "Cargando los datos y tus permisos."}</p>
          <button className="button primary" onClick={() => void sync()}>
            Reintentar
          </button>
          <button className="button secondary" onClick={onBack}>
            Volver a mis eventos
          </button>
        </div>
      </div>
    );
  return (
    <CloudContext.Provider
      value={{
        event,
        user,
        organizer,
        canEvaluate,
        actor,
        members,
        ranking,
        snapshot,
        set,
        refresh,
        error,
        pending: Object.keys(snapshot.drafts).length,
        busy,
        lastSync,
        invite,
        remove,
        discard,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
}
export function useCloudValue<T>(key: string, initial: T) {
  const cloud = useCloud();
  const fallback = cloud && Array.isArray(initial) ? [] : initial;
  const value = (cloud?.snapshot.data[key] ?? fallback) as T;
  const set = (next: SetStateAction<T>) =>
    cloud?.set(
      key,
      typeof next === "function" ? (next as (old: T) => T)(value) : next,
    );
  return [value, set] as const;
}
