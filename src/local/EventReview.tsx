import type { Member } from "../RolePicker";
import {
  eventSize,
  validJoinUrl,
  memberRoles,
} from "../../shared/event-profile.mjs";
import { Gamepad2, ArrowLeft, Settings } from "lucide-react";
import type { LocalSnapshot, JamAnswers } from "./types";
import { jamDate, inputDate } from "./dates";
export function hydratedJam(snapshot: LocalSnapshot) {
  const event = snapshot.state.find((r) => r.key === "gj-event")?.value as
    Record<string, string | boolean> | undefined;
  const members = snapshot.state.find((r) => r.key === "gj-members")?.value as
    Member[] | undefined;
  return {
    ...snapshot.jam,
    answers: {
      ...snapshot.jam.answers,
      ...(members
        ? {
            crew: members
              .filter(
                (m) =>
                  m.email.toLowerCase() !== snapshot.user.email.toLowerCase(),
              )
              .map((m) => ({ ...m, roles: memberRoles(m) })),
          }
        : {}),
      ...(event
        ? {
            start: inputDate(String(event.start || "")),
            end: inputDate(String(event.end || "")),
            planningStart: inputDate(
              String(event.planningStart || snapshot.jam.createdAt || ""),
            ),
            mode: event.mode,
            venue: event.venue,
            platform: event.platform,
            joinUrl: event.joinUrl,
            framework: event.framework,
            frameworkName: event.frameworkName,
          }
        : {}),
    } as JamAnswers,
  };
}
export function EventReview({
  snapshot,
  onBack,
  onEdit,
}: {
  snapshot: LocalSnapshot;
  onBack: () => void;
  onEdit: () => void;
}) {
  const jam = hydratedJam(snapshot),
    a = jam.answers;
  const facts = [
    ["Edición", jam.edition || "Sin edición"],
    ["Modalidad", a.mode],
    [
      "Inicio",
      jamDate(a.start || "", { dateStyle: "long", timeStyle: "short" }),
    ],
    ["Fin", jamDate(a.end || "", { dateStyle: "long", timeStyle: "short" })],
    [
      "Inicio de planeación",
      jamDate(a.planningStart || "", { dateStyle: "long" }),
    ],
    ["Sede", a.venue],
    ["Plataforma", a.platform],
    ["Enlace de acceso", a.joinUrl],
    ["Universidad", a.university ? a.universityRelation : "No"],
    ["Evento marco", a.framework ? a.frameworkName : "No"],
    ["Participantes esperados", a.participants],
    ["Tamaño del evento (sin organizadores)", eventSize(a.participants)],
    ["Infraestructura", a.infrastructure ? "Disponible" : "Por confirmar"],
    ["Socio clave", a.partner ? a.partnerName : "No"],
    ["Grupo o sociedad civil", a.civil ? a.civilName : "No"],
    ["Asociación estudiantil", a.student ? a.studentName : "No"],
    ["Equipo previsto", a.teamSize],
  ];
  return (
    <div className="jam-entry">
      <section className="jam-onboarding">
        <header className="jam-entry-header">
          <span className="brand-icon">
            <Gamepad2 />
          </span>
          <strong>
            {jam.name} {jam.edition}
          </strong>
        </header>
        <h1>Respuestas del evento</h1>
        <p>
          Consulta la configuración guardada. Puedes volver al dashboard sin
          recorrer el cuestionario.
        </p>
        <dl className="event-review">
          {facts
            .filter(([, value]) => value !== undefined && value !== "")
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {label === "Enlace de acceso" && validJoinUrl(value) ? (
                    <a
                      href={String(value)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
        </dl>
        <div className="jam-question-actions">
          <button className="button secondary" onClick={onBack}>
            <ArrowLeft size={15} />
            Volver al dashboard
          </button>
          <button className="button primary" onClick={onEdit}>
            <Settings size={15} />
            Editar configuración
          </button>
        </div>
      </section>
    </div>
  );
}
