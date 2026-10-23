import { createId } from "../id";
import { useEffect, useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import { eventReminders } from "../../shared/planning.mjs";
import { useLocal } from "../storage";
import { useLocalEvent } from "./store";
import { inputDate, jamDate } from "./dates";
import { PushControls } from "../PushControls";
export type CustomReminder = {
  id: string;
  audience: string;
  level: string;
  text: string;
  at: string;
};
export function useEventNotices() {
  const [event] = useLocal<{
      start: string;
      end?: string;
      planningStart?: string;
    }>("gj-event", { start: "" }),
    [custom] = useLocal<CustomReminder[]>("gj-reminders", []);
  return eventReminders(event, custom);
}
export function ReminderBanner({ onOpen }: { onOpen: () => void }) {
  const local = useLocalEvent()!,
    items = useEventNotices(),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = items.filter(
    (r) =>
      (r.audience === "Organizadores" || r.audience === "Todos") &&
      r.at >= now - 86400000 &&
      r.at <= now + 86400000,
  );
  const important = upcoming.find((r) => r.level === "critical") || upcoming[0];
  useEffect(() => {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !("serviceWorker" in navigator)
    )
      return;
    for (const r of items.filter(
      (r) =>
        (r.audience === "Organizadores" || r.audience === "Todos") &&
        r.at <= now &&
        r.at > now - 86400000,
    )) {
      const key = `gj-notified:${local.jam.id}:${r.id}:${r.at}`;
      if (localStorage.getItem(key)) continue;
      void navigator.serviceWorker.ready
        .then(async (reg) => {
          if (!(await reg.pushManager?.getSubscription()))
            await reg.showNotification(local.jam.name, {
              body: r.text,
              icon: "/icon.svg",
            });
        })
        .then(() => localStorage.setItem(key, "1"))
        .catch(() => {});
    }
  }, [now, local.jam.id, JSON.stringify(items)]);
  return (
    <button
      className={`event-alert notice-${important?.level || "info"}`}
      onClick={onOpen}
    >
      <Bell size={19} />
      <span>
        <strong>
          {important ? important.text : "Tu centro de recordatorios"}
        </strong>
        <small>
          {important
            ? `${important.at < now ? "Pendiente reciente" : "Próximo"} · ${jamDate(new Date(important.at).toISOString(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
            : `${items.length} avisos programados por audiencia. Consulta fechas y prioridades.`}
        </small>
      </span>
      <span>Ver avisos →</span>
    </button>
  );
}
export function OperationalReminders() {
  const local = useLocalEvent()!,
    [custom, setCustom] = useLocal<CustomReminder[]>("gj-reminders", []),
    items = useEventNotices(),
    [filter, setFilter] = useState("Todos"),
    [message, setMessage] = useState("");
  return (
    <section className="panel operation-panel">
      <div className="section-heading">
        <div>
          <h3>
            <Bell size={19} />
            Recordatorios por audiencia
          </h3>
          <p>
            Rojo: urgente. Verde: acción requerida. Azul: información. Cada
            tarjeta conserva también su etiqueta de texto.
          </p>
        </div>
        <label>
          Filtrar audiencia
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["Todos", "Organizadores", "Jueces", "Participantes"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="notice-list">
        {items
          .filter(
            (r) =>
              filter === "Todos" ||
              r.audience === "Todos" ||
              r.audience === filter,
          )
          .map((r) => (
            <article key={r.id} className={`notice-card notice-${r.level}`}>
              <span>
                {r.audience} ·{" "}
                {r.level === "critical"
                  ? "Urgente"
                  : r.level === "action"
                    ? "Acción requerida"
                    : "Información"}
              </span>
              <h4>{r.text}</h4>
              <time>
                {jamDate(new Date(r.at).toISOString(), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              {custom.some((c) => c.id === r.id) ? (
                <button
                  className="text-button"
                  aria-label={`Eliminar aviso ${r.text}`}
                  onClick={() => setCustom(custom.filter((c) => c.id !== r.id))}
                >
                  <Trash2 size={13} />
                  Eliminar
                </button>
              ) : (
                <small>Automático según las fechas del evento</small>
              )}
            </article>
          ))}
      </div>
      <h3>Programar otro aviso</h3>
      <form
        className="operation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          setCustom([
            ...custom,
            {
              id: createId(),
              text: String(f.get("text")).trim(),
              audience: String(f.get("audience")),
              level: String(f.get("level")),
              at: new Date(String(f.get("at"))).toISOString(),
            },
          ]);
          form.reset();
          setMessage("Aviso agregado; revisa el indicador de guardado.");
        }}
      >
        <label>
          Mensaje del aviso
          <input name="text" required maxLength={500} />
        </label>
        <label>
          Fecha y hora del aviso
          <input
            name="at"
            type="datetime-local"
            required
            defaultValue={inputDate(new Date().toISOString())}
          />
        </label>
        <label>
          Destinatarios
          <select name="audience">
            {["Organizadores", "Jueces", "Participantes", "Todos"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Nivel
          <select name="level">
            <option value="info">Azul · Información</option>
            <option value="action">Verde · Acción requerida</option>
            <option value="critical">Rojo · Urgente</option>
          </select>
        </label>
        <button className="button primary">
          <Plus size={15} />
          Programar aviso
        </button>
      </form>
      <PushControls notify={setMessage} jamId={local.jam.id} />
      {message && <p role="status">{message}</p>}
      <p className="info-note">
        Los avisos permanecen visibles aquí. Web Push requiere permiso del
        navegador, HTTPS o localhost y el servidor encendido. Un aviso con la
        app cerrada solo se entrega a los dispositivos que activaron la
        suscripción.
      </p>
    </section>
  );
}

export function NextReminderCard({ onOpen }: { onOpen: () => void }) {
  const items = useEventNotices();
  const next = items.find(
    (r) =>
      (r.audience === "Organizadores" || r.audience === "Todos") &&
      r.at >= Date.now(),
  );
  return (
    <section
      className={`panel next-panel ${next ? "notice-" + next.level : ""}`}
    >
      <div className="section-heading">
        <h3>
          <Bell size={17} />
          Próximo recordatorio
        </h3>
      </div>
      {next ? (
        <>
          <span className="reminder-label">
            {next.audience} ·{" "}
            {next.level === "critical"
              ? "Urgente"
              : next.level === "action"
                ? "Acción requerida"
                : "Información"}
          </span>
          <h4>{next.text}</h4>
          <p>
            {jamDate(new Date(next.at).toISOString(), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </>
      ) : (
        <p>No hay próximos avisos para el organizador.</p>
      )}
      <button className="text-button" onClick={onOpen}>
        Abrir recordatorios →
      </button>
    </section>
  );
}
