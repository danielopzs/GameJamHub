import { Gamepad2, ArrowLeft, Settings } from "lucide-react";
import type { LocalSnapshot, JamAnswers } from "./types";
import { jamDate, inputDate } from "./dates";
export function hydratedJam(snapshot: LocalSnapshot) {
  const event = snapshot.state.find((r) => r.key === "gj-event")?.value as
    Record<string, string | boolean> | undefined;
  return {
    ...snapshot.jam,
    answers: {
      ...snapshot.jam.answers,
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
    ["Universidad", a.university ? a.universityRelation : "No"],
    ["Evento marco", a.framework ? a.frameworkName : "No"],
    ["Participantes esperados", a.participants],
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
                <dd>{value}</dd>
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
