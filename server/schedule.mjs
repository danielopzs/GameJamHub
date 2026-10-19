export const reminders = [
  {
    day: -60,
    role: "General",
    text: "Conformar comité organizador de 5 direcciones.",
  },
  {
    day: -30,
    role: "Logística",
    text: "Confirmar acceso a venue 24/7 y red 20+ Mbps.",
  },
  {
    day: -7,
    role: "Catering",
    text: "Confirmar insumos: 300 cafés, 450 refrescos y pizzas para 150p.",
  },
  {
    day: -1,
    role: "Streaming",
    text: "Verificar OBS, overlays y canales de Discord.",
  },
  {
    day: 46 / 24,
    role: "Staff & Participantes",
    text: "🚨 Quedan 2 horas para subir juegos a Itch.io.",
  },
];
export function dueReminders(start, now = Date.now()) {
  const timestamp = Date.parse(start);
  if (!Number.isFinite(timestamp)) return [];
  return reminders
    .map((r, index) => ({ ...r, index, at: timestamp + r.day * 86400000 }))
    .filter((r) => now >= r.at && now - r.at < 86400000);
}
