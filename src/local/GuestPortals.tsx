import { useEffect, useState } from "react";
import { Gamepad2, LogOut, CheckCircle2 } from "lucide-react";
import { localApi, type Organizer, type LocalJam } from "./types";
import { criteria } from "../data";
import { jamDate } from "./dates";
import { PushControls } from "../PushControls";
import type { ScheduledReminder } from "../../shared/planning.mjs";
type PublicEvent = {
  name: string;
  edition: string;
  start: string;
  end: string;
  mode: string;
  venue: string;
  platform: string;
  registrationOpen: boolean;
};
type Person = {
  name: string;
  email: string;
  ticketCode: string;
  checkedIn: boolean;
  teamCode: string;
};
type Team = {
  code: string;
  name: string;
  game: string;
  time: string;
  submission: string;
  submitted: boolean;
};
type Portal = {
  tasks: { id: number; title: string; owner: string; status: string }[];
  members: { name: string; role: string }[];
  event: PublicEvent;
  teams: Team[];
  scorecards: { teamCode: string; scores: number[]; revision: number }[];
  reminders: ScheduledReminder[];
};
function Header({ event }: { event: PublicEvent }) {
  return (
    <>
      <div className="jam-access-brand">
        <span className="brand-icon">
          <Gamepad2 />
        </span>
        <strong>
          {event.name} <span>{event.edition}</span>
        </strong>
      </div>
      <p>
        {jamDate(event.start, { dateStyle: "long", timeStyle: "short" })} ·{" "}
        {event.mode}
      </p>
      <p>{[event.venue, event.platform].filter(Boolean).join(" · ")}</p>
    </>
  );
}
export function PublicRegistration({
  id,
  onTicket,
}: {
  id: string;
  onTicket: (token: string) => void;
}) {
  const [data, setData] = useState<{
      event: PublicEvent;
      remaining: number;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void localApi<{ event: PublicEvent; remaining: number }>(`public/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="jam-entry">
      <section className="jam-access-card">
        {data && <Header event={data.event} />}
        <h1>Inscríbete al jam</h1>
        {data && (
          <>
            <p>
              {data.remaining} lugares disponibles · Tu registro será visible
              para el comité.
            </p>
            <form
              className="cloud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const form = Object.fromEntries(
                    new FormData(e.currentTarget).entries(),
                  );
                  const result = await localApi<{ token: string }>(
                    `public/${id}`,
                    { method: "POST", body: JSON.stringify(form) },
                  );
                  onTicket(result.token);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Nombre completo
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
              <label>
                Correo de contacto
                <input
                  name="email"
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label>
                Código de equipo (opcional)
                <input name="teamCode" maxLength={40} />
              </label>
              <label className="registration-honeypot" aria-hidden="true">
                Sitio web
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />
                Acepto compartir mis datos con el comité de esta edición para
                gestionar mi participación.
              </label>
              <button
                className="button primary"
                disabled={busy || !data.remaining}
              >
                {busy ? "Registrando…" : "Confirmar inscripción"}
              </button>
            </form>
            <p className="jam-access-note">
              No necesitas crear una cuenta. Al terminar, guarda tu enlace
              personal: será tu comprobante. No se envía un correo automático.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="cloud-error">
            {error}
          </p>
        )}
        <a className="text-button" href="/">
          Acceso del organizador o jurado
        </a>
      </section>
    </div>
  );
}
export function TicketPortal({ token }: { token: string }) {
  const [data, setData] = useState<{
      event: PublicEvent;
      person: Person;
      reminders: ScheduledReminder[];
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void localApi<typeof data>("ticket", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
        .then((r) => {
          if (active) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  return (
    <div className="jam-entry">
      <section className="jam-onboarding">
        {data && (
          <>
            <Header event={data.event} />
            <span className="eyebrow">TU COMPROBANTE PERSONAL</span>
            <h1>¡Tu lugar está registrado!</h1>
            <p>
              {data.person.name} · {data.person.email}
            </p>
            <div className="ticket-code">
              <small>Presenta este código al llegar</small>
              <strong>{data.person.ticketCode}</strong>
              <span>
                <CheckCircle2 size={17} />
                {data.person.checkedIn
                  ? "Entrada confirmada"
                  : "Check-in pendiente"}
              </span>
            </div>
            <p>Equipo: {data.person.teamCode || "Por asignar"}</p>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setMessage("Enlace copiado");
                } catch {
                  setMessage(
                    "Copia la dirección de este navegador para guardar tu comprobante.",
                  );
                }
              }}
            >
              Copiar mi enlace personal
            </button>
            <p>
              Guarda este enlace y mantenlo privado. El organizador hará el
              check-in al llegar.
            </p>
            <ReminderList items={data.reminders} />
            <PushControls notify={setMessage} audience="Participantes" />
          </>
        )}
        {error && (
          <p role="alert" className="cloud-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <a className="text-button" href="/">
          Ir al inicio
        </a>
      </section>
    </div>
  );
}
export function ReminderList({ items }: { items: ScheduledReminder[] }) {
  return (
    <section className="guest-notices">
      <h2>Recordatorios para ti</h2>
      {items.map((r) => (
        <article className={`notice-card notice-${r.level}`} key={r.id}>
          <span>
            {r.level === "critical"
              ? "Urgente"
              : r.level === "action"
                ? "Acción requerida"
                : "Información"}{" "}
            · {r.audience}
          </span>
          <h3>{r.text}</h3>
          <time>
            {jamDate(new Date(r.at).toISOString(), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </article>
      ))}
      {!items.length && <p>No hay avisos programados.</p>}
    </section>
  );
}
export function GuestPortal({
  jam,
  user,
  onExit,
}: {
  jam: LocalJam;
  user: Organizer;
  onExit: () => Promise<void>;
}) {
  const [data, setData] = useState<Portal | null>(null),
    [code, setCode] = useState(""),
    [scores, setScores] = useState<number[]>(criteria.map(() => 0)),
    [revision, setRevision] = useState(0),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const result = await localApi<Portal>(`jams/${jam.id}/portal`);
    setData(result);
    return result;
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(
      () => void load().catch((e) => setError(e.message)),
      5000,
    );
    return () => clearInterval(timer);
  }, [jam.id]);
  function select(value: string) {
    if (
      dirty &&
      !confirm(
        "Hay una evaluación sin guardar. ¿Cambiar de equipo y descartar ese borrador?",
      )
    )
      return;
    const saved = data?.scorecards.find((s) => s.teamCode === value);
    setCode(value);
    setScores(saved?.scores || criteria.map(() => 0));
    setRevision(saved?.revision || 0);
    setDirty(false);
    setError("");
    setMessage("");
  }
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const team = data?.teams.find((t) => t.code === code);
  return (
    <div className="guest-shell">
      <header className="guest-header">
        <strong>
          {jam.name} {jam.edition}
        </strong>
        <span>
          {user.name} ·{" "}
          {user.role === "judge"
            ? "Jurado"
            : user.role === "staff"
              ? "Comité"
              : "Participante"}
        </span>
        <button
          className="button secondary"
          onClick={() => {
            if (
              !dirty ||
              confirm("¿Salir y descartar la evaluación sin guardar?")
            )
              void onExit().catch((e) => setError(e.message));
          }}
        >
          <LogOut size={15} />
          Salir
        </button>
      </header>
      {error && (
        <p className="cloud-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <Header event={data.event} />
          {user.role === "staff" && (
            <section className="panel guest-rubric">
              <h1>Tareas del comité</h1>
              <p>
                Distribuye responsabilidades y actualiza el avance. Los cambios
                se comparten con el organizador.
              </p>
              {data.tasks.map((task) => (
                <article className="staff-task" key={task.id}>
                  <strong>{task.title}</strong>
                  <label>
                    Responsable de {task.title}
                    <select
                      aria-label={`Responsable de ${task.title}`}
                      value={task.owner}
                      onChange={async (e) => {
                        try {
                          await localApi(`jams/${jam.id}/tasks/${task.id}`, {
                            method: "PUT",
                            body: JSON.stringify({
                              owner: e.target.value,
                              status: task.status,
                              expected: {
                                owner: task.owner,
                                status: task.status,
                              },
                            }),
                          });
                          await load();
                          setError("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {data.members.map((m) => (
                        <option key={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado de {task.title}
                    <select
                      aria-label={`Estado de ${task.title}`}
                      value={task.status}
                      onChange={async (e) => {
                        try {
                          await localApi(`jams/${jam.id}/tasks/${task.id}`, {
                            method: "PUT",
                            body: JSON.stringify({
                              owner: task.owner,
                              status: e.target.value,
                              expected: {
                                owner: task.owner,
                                status: task.status,
                              },
                            }),
                          });
                          await load();
                          setError("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {["Pendiente", "En progreso", "Completada"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </section>
          )}
          {user.role === "judge" && (
            <section className="panel guest-rubric">
              <h1>Evaluación del jurado</h1>
              <p>
                {data.scorecards.length} / {data.teams.length} equipos
                evaluados. Tus puntuaciones se guardan bajo tu cuenta; no puedes
                editar las de otro juez.
              </p>
              <label>
                Equipo para evaluar
                <select value={code} onChange={(e) => select(e.target.value)}>
                  <option value="">Selecciona un equipo</option>
                  {data.teams.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} · {t.name} · {t.game}
                    </option>
                  ))}
                </select>
              </label>
              {team && (
                <>
                  <p>Presentación: {team.time || "Por definir"}</p>
                  {team.submission ? (
                    <a
                      className="button secondary"
                      href={team.submission}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir juego entregado
                    </a>
                  ) : (
                    <p className="info-note">
                      El equipo todavía no tiene un enlace de entrega
                      registrado.
                    </p>
                  )}
                  <div className="guest-score-grid">
                    {criteria.map(([label, max], i) => (
                      <label key={label}>
                        {label}
                        <input
                          aria-label={label}
                          type="number"
                          min={0}
                          max={max}
                          step={0.5}
                          value={scores[i]}
                          onChange={(e) => {
                            setScores(
                              scores.map((v, j) =>
                                i === j
                                  ? Math.min(
                                      max,
                                      Math.max(0, Number(e.target.value)),
                                    )
                                  : v,
                              ),
                            );
                            setDirty(true);
                            setMessage("");
                          }}
                        />
                        <small>/ {max}</small>
                      </label>
                    ))}
                  </div>
                  <div className="between">
                    <strong>
                      Total: {scores.reduce((a, b) => a + b, 0)} / 120
                    </strong>
                    <button
                      className="button primary"
                      disabled={busy || !dirty}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await localApi(
                            `jams/${jam.id}/scorecards/${encodeURIComponent(code)}`,
                            {
                              method: "PUT",
                              body: JSON.stringify({ scores, revision }),
                            },
                          );
                          const updated = await load();
                          setRevision(
                            updated.scorecards.find((s) => s.teamCode === code)
                              ?.revision || 0,
                          );
                          setDirty(false);
                          setMessage("Evaluación guardada");
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Guardar evaluación
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          <ReminderList items={data.reminders} />
          <PushControls
            notify={setMessage}
            audience={
              user.role === "judge"
                ? "Jueces"
                : user.role === "staff"
                  ? "Organizadores"
                  : "Participantes"
            }
          />
        </>
      )}
    </div>
  );
}
