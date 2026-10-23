import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Monitor,
  Users,
} from "lucide-react";
import { useLocalEvent } from "./store";
import { jamDate, taskDate } from "./dates";
import type { Task } from "../data";
export function EventOverview({
  tasks,
  start,
  onTasks,
  onDates,
}: {
  tasks: Task[];
  start: string;
  onTasks: () => void;
  onDates: () => void;
}) {
  const local = useLocalEvent();
  if (!local) return null;
  const captured = local.jam.answers;
  const event = local.data["gj-event"] as {
    mode: string;
    venue: string;
    framework: boolean;
    frameworkName: string;
  };
  const answers = {
    ...captured,
    framework: event.framework,
    frameworkName: event.frameworkName,
  };
  const hasDate = Number.isFinite(new Date(start).getTime());
  const upcoming = tasks
    .filter((t) => t.status !== "Completada")
    .sort((a, b) =>
      hasDate
        ? a.day - b.day || a.priority - b.priority
        : a.phase - b.phase || a.priority - b.priority,
    )
    .slice(0, 5);
  return (
    <div className="jam-dashboard-summary">
      <section className="panel jam-facts">
        <h3>Así será tu jam</h3>
        <div>
          <span>
            {event.mode === "Virtual" ? (
              <Monitor size={18} />
            ) : (
              <MapPin size={18} />
            )}
            <small>{event.mode === "Virtual" ? "Plataforma" : "Sede"}</small>
            <strong>{event.venue}</strong>
          </span>
          <span>
            <Users size={18} />
            <small>Participantes esperados</small>
            <strong>{answers.participants ?? "Por confirmar"}</strong>
          </span>
          <span>
            <Users size={18} />
            <small>Equipo organizador</small>
            <strong>{answers.teamSize ?? "Por confirmar"} personas</strong>
          </span>
          <span>
            <CalendarDays size={18} />
            <small>Infraestructura</small>
            <strong>
              {answers.infrastructure ? "Disponible" : "Por confirmar"}
            </strong>
          </span>
        </div>
        {answers.framework && (
          <p>
            En el marco de <strong>{answers.frameworkName}</strong>
          </p>
        )}
        {(answers.partner || answers.civil) && (
          <p>
            Nos acompañan:{" "}
            {[answers.partnerName, answers.civilName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>
      <section className="panel jam-upcoming">
        <div className="section-heading">
          <div>
            <h3>
              <Clock size={17} />
              Próximas tareas
            </h3>
            <p>Lo siguiente para hacer posible tu evento.</p>
          </div>
          <button className="text-button" onClick={onTasks}>
            Ver tareas <ArrowRight size={14} />
          </button>
        </div>
        {!hasDate && (
          <div className="jam-no-dates">
            <p>
              Agrega las fechas del evento para calcular vencimientos. Mientras
              tanto, ordenamos las tareas por fase y prioridad.
            </p>
            <button className="text-button" onClick={onDates}>
              Agregar fechas <ArrowRight size={13} />
            </button>
          </div>
        )}
        <div className="jam-upcoming-list">
          {upcoming.map((t) => {
            const due = taskDate(start, t.day);
            const overdue = due && new Date(due).getTime() < Date.now();
            return (
              <button key={t.id} onClick={onTasks}>
                <span className={`jam-urgency urgency-${t.priority}`} />
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.owner}</small>
                </span>
                <span className={overdue ? "jam-overdue" : ""}>
                  {due
                    ? (overdue ? "Vencida · " : "") + jamDate(due)
                    : "Por programar"}
                </span>
                <ArrowRight size={14} />
              </button>
            );
          })}
          {!upcoming.length && (
            <p className="empty">¡Todas las tareas están completadas!</p>
          )}
        </div>
      </section>
    </div>
  );
}
