import { taskTimestamp } from "../shared/planning.mjs";
import { Check, MoreHorizontal } from "lucide-react";
import { phases, type Task } from "./data";
import { Avatar } from "./Avatar";
import { jamDate, taskDate } from "./local/dates";
const priorities = ["Crítica", "Alta", "Media", "Baja"];
export function TaskTable({
  items,
  members,
  eventStart,
  eventEnd,
  planningStart,
  onUpdate,
  onEdit,
}: {
  items: Task[];
  members: { name: string; color: string }[];
  eventStart: string;
  eventEnd?: string;
  planningStart?: string;
  onUpdate: (id: number, status: string) => void;
  onEdit: (id: number) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="checkbox-cell">
              <span className="check-box" />
            </th>
            <th>Tarea</th>
            <th>Responsable</th>
            <th>Prioridad</th>
            <th>Fecha límite</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <button
                  aria-label="Completar tarea"
                  onClick={() =>
                    onUpdate(
                      t.id,
                      t.status === "Completada" ? "Pendiente" : "Completada",
                    )
                  }
                  className={`check-box ${t.status === "Completada" ? "checked" : ""}`}
                >
                  {t.status === "Completada" && <Check size={12} />}
                </button>
              </td>
              <td className={t.status === "Completada" ? "done-title" : ""}>
                {t.title}
                <small>{phases[t.phase].split(" · ")[0]}</small>
              </td>
              <td>
                <div className="person">
                  <Avatar
                    name={t.owner}
                    small
                    color={members.find((m) => m.name === t.owner)?.color}
                  />
                  <span>{t.owner}</span>
                </div>
              </td>
              <td>
                <span className={`priority p${t.priority}`}>
                  <i />
                  {priorities[t.priority]}
                </span>
              </td>
              <td className="muted">
                {jamDate(
                  planningStart || eventEnd
                    ? Number.isFinite(
                        taskTimestamp(
                          { start: eventStart, end: eventEnd, planningStart },
                          t,
                        ),
                      )
                      ? new Date(
                          taskTimestamp(
                            { start: eventStart, end: eventEnd, planningStart },
                            t,
                          ),
                        ).toISOString()
                      : ""
                    : taskDate(eventStart, t.day),
                  {
                    day: "2-digit",
                    month: "short",
                  },
                )}
              </td>
              <td>
                <select
                  className={`status-select ${t.status === "En progreso" ? "in-progress" : t.status === "Completada" ? "complete" : ""}`}
                  value={t.status}
                  onChange={(e) => onUpdate(t.id, e.target.value)}
                >
                  <option>Pendiente</option>
                  <option>En progreso</option>
                  <option>Completada</option>
                </select>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label="Editar tarea"
                  onClick={() => onEdit(t.id)}
                >
                  <MoreHorizontal size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && (
        <div className="empty">
          No hay tareas que coincidan con tu búsqueda.
        </div>
      )}
    </div>
  );
}
