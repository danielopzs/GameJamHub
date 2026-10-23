import { CalendarDays, Check } from "lucide-react";
import { taskTimestamp } from "../../shared/planning.mjs";
import { phases, type Task } from "../data";
import { jamDate } from "./dates";
export function Timeline({
  tasks,
  event,
  onUpdate,
}: {
  tasks: Task[];
  event: { start: string; end?: string; planningStart?: string };
  onUpdate: (id: number, status: string) => void;
}) {
  const scheduled = tasks
      .map((t) => ({ ...t, at: taskTimestamp(event, t) }))
      .filter((t) => Number.isFinite(t.at))
      .sort((a, b) => a.at - b.at || a.priority - b.priority),
    start = Math.min(
      Date.parse(event.planningStart || event.start),
      ...scheduled.map((t) => t.at),
    ),
    end = Math.max(
      Date.parse(event.end || event.start),
      ...scheduled.map((t) => t.at),
    ),
    span = Math.max(1, end - start),
    now = Date.now();
  if (!scheduled.length)
    return (
      <p className="empty">
        Completa las fechas del evento para generar el cronograma.
      </p>
    );
  return (
    <section className="timeline">
      <div className="timeline-heading">
        <h3>
          <CalendarDays size={17} />
          De la planeación a la retrospectiva
        </h3>
        <p>
          {jamDate(new Date(start).toISOString())} —{" "}
          {jamDate(new Date(end).toISOString())} · las tareas previas se ajustan
          si tienes menos de 60 días.
        </p>
      </div>
      <div className="timeline-axis">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>
            {jamDate(new Date(start + span * f).toISOString())}
          </span>
        ))}
      </div>
      {phases.map((phase, index) => {
        const rows = scheduled.filter((t) => t.phase === index);
        if (!rows.length) return null;
        const min = rows[0].at,
          max = rows[rows.length - 1].at;
        return (
          <details key={phase} className="timeline-phase" open>
            <summary>
              <strong>{phase.split(" · ")[0]}</strong>
              <span>
                {rows.filter((t) => t.status === "Completada").length}/
                {rows.length} listas
              </span>
              <time>
                {jamDate(new Date(min).toISOString())}
                {max !== min
                  ? " – " + jamDate(new Date(max).toISOString())
                  : ""}
              </time>
            </summary>
            <div className="timeline-track">
              <span
                style={{
                  left: `${Math.min(97, ((min - start) / span) * 100)}%`,
                  width: `${Math.max(2, Math.min(100 - ((min - start) / span) * 100, ((max - min) / span) * 100))}%`,
                }}
              />
              {now >= start && now <= end && (
                <i
                  title="Hoy"
                  style={{ left: `${((now - start) / span) * 100}%` }}
                />
              )}
            </div>
            {rows.map((t) => (
              <div className="timeline-task" key={t.id}>
                <button
                  className={`check-box ${t.status === "Completada" ? "checked" : ""}`}
                  aria-label={`Completar ${t.title}`}
                  onClick={() =>
                    onUpdate(
                      t.id,
                      t.status === "Completada" ? "Pendiente" : "Completada",
                    )
                  }
                >
                  {t.status === "Completada" && <Check size={12} />}
                </button>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {t.owner} ·{" "}
                    {["Crítica", "Alta", "Media", "Baja"][t.priority]}
                  </small>
                </div>
                <time
                  className={
                    t.at < now && t.status !== "Completada" ? "jam-overdue" : ""
                  }
                >
                  {jamDate(new Date(t.at).toISOString(), {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <span className="subtle-chip">{t.status}</span>
              </div>
            ))}
          </details>
        );
      })}
    </section>
  );
}
