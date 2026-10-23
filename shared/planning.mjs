const DAY = 86400000;
export function taskTimestamp(event, task) {
  const start = Date.parse(event.start),
    end = Date.parse(event.end);
  if (!Number.isFinite(start)) return NaN;
  if (task.id === 45 && Number.isFinite(end))
    return Math.max(start, end - 2 * 3600000);
  if (task.id === 46 && Number.isFinite(end)) return end;
  if (task.phase === 5 && Number.isFinite(end))
    return end + Math.max(1, task.day - 2) * DAY;
  if (task.day < 0) {
    const planning = Date.parse(event.planningStart);
    const window = Number.isFinite(planning)
      ? Math.min(60 * DAY, Math.max(0, start - planning))
      : 60 * DAY;
    return start + (task.day / 60) * window;
  }
  return start + task.day * DAY;
}
export const automaticReminders = [
  {
    id: "committee",
    day: -60,
    role: "General",
    audience: "Organizadores",
    level: "action",
    text: "Conformar el comité y asignar responsables.",
  },
  {
    id: "venue",
    day: -30,
    role: "Logística",
    audience: "Organizadores",
    level: "critical",
    text: "Confirmar la sede, acceso e infraestructura presencial y/o virtual.",
  },
  {
    id: "catering",
    day: -7,
    role: "Catering",
    audience: "Organizadores",
    level: "action",
    text: "Confirmar catering e insumos según los participantes esperados.",
  },
  {
    id: "streaming",
    day: -1,
    role: "Streaming",
    audience: "Organizadores",
    level: "action",
    text: "Verificar streaming y canales de comunicación.",
  },
  {
    id: "judge-ready",
    day: -1,
    role: "Jueces",
    audience: "Jueces",
    level: "info",
    text: "Revisa tu acceso, la rúbrica y los equipos antes del jueceo.",
  },
  {
    id: "participant-start",
    day: 0,
    role: "Participantes",
    audience: "Participantes",
    level: "info",
    text: "Comienza el jam. Consulta la sede o plataforma y las indicaciones del evento.",
  },
  {
    id: "upload",
    day: 46 / 24,
    role: "Staff & Participantes",
    audience: "Todos",
    level: "critical",
    text: "Quedan 2 horas para entregar los juegos. Revisa el enlace de entrega.",
  },
  {
    id: "judge-now",
    day: 2,
    role: "Jueces",
    audience: "Jueces",
    level: "action",
    text: "Es momento de revisar las entregas y guardar tus evaluaciones.",
  },
];
export function eventReminders(event, custom = []) {
  const start = Date.parse(event.start),
    end = Date.parse(event.end);
  const auto = automaticReminders.map((r) => ({
    ...r,
    at:
      r.id === "upload" && Number.isFinite(end)
        ? Math.max(start, end - 7200000)
        : r.id === "judge-now" && Number.isFinite(end)
          ? end
          : r.day === -1
            ? Math.max(
                start - DAY,
                Number.isFinite(Date.parse(event.planningStart))
                  ? Math.min(start, Date.parse(event.planningStart))
                  : -Infinity,
              )
            : r.day < 0
              ? taskTimestamp(event, { id: -1, day: r.day, phase: 0 })
              : start + r.day * DAY,
  }));
  return [
    ...auto,
    ...custom.map((r) => ({ ...r, role: r.audience, at: Date.parse(r.at) })),
  ]
    .filter((r) => Number.isFinite(r.at))
    .sort((a, b) => a.at - b.at);
}
