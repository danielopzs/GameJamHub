export const roles = [
  "Director General / Líder del Jam",
  "Director de Logística & Venue",
  "Director de Marketing & Prensa",
  "Director de Imagen & Arte",
  "Director de Streaming & TI",
  "Director de Vinculación & Patrocinios",
  "Host / Entrada & Registro",
  "Premios & Goodies",
  "Orador Principal / MC",
  "Fotografía & Entrevistas",
  "Torneos & Recreación",
  "Coordinador de Mentores Técnicos",
];
export const phases = [
  "Planeación · T-60d",
  "Producción · T-30d",
  "Difusión · T-14d",
  "Últimos detalles · T-7d",
  "¡Game jam! · T-0",
  "Post-mortem",
];
export type Task = {
  id: number;
  title: string;
  phase: number;
  priority: number;
  status: string;
  owner: string;
  day: number;
};
const groups = [
  [
    "Conformar comité organizador",
    "Reservar y confirmar el venue",
    "Definir presupuesto y recursos",
    "Contactar patrocinadores",
    "Diseñar identidad del evento",
  ],
  [
    "Confirmar acceso al venue 24/7",
    "Verificar red de 20+ Mbps",
    "Contratar ambulancia para más de 100 personas",
    "Invitar y confirmar jueces",
    "Gestionar pases VIP y booths",
    "Convocar mentores técnicos",
  ],
  [
    "Publicar póster oficial",
    "Enviar boletín de prensa",
    "Producir reels de difusión",
    "Abrir registro de participantes",
    "Definir premios y goodies",
  ],
  [
    "Confirmar catering e insumos para 150 personas",
    "Asignar turnos de registro",
    "Verificar OBS y overlays",
    "Configurar canales de Discord",
    "Preparar agenda de pitching",
  ],
  [
    "Revelar la temática",
    "Coordinar mentorías",
    "Organizar torneo de Smash",
    "Organizar karaoke",
    "Fotografiar y entrevistar equipos",
    "Recordar subida de juegos a Itch.io",
    "Coordinar presentaciones y jueceo",
  ],
  [
    "Publicar resultados y entregar premios",
    "Enviar agradecimientos a patrocinadores",
    "Realizar retrospectiva del comité",
  ],
];
export const initialTasks: Task[] = groups.flatMap((g, p) =>
  g.map((title, i) => ({
    id: p * 10 + i,
    title,
    phase: p,
    priority: /venue|20\+|ambulancia|temática|Itch/.test(title)
      ? 0
      : /patrocin|jueces|VIP|catering|pitching/i.test(title)
        ? 1
        : /Smash|karaoke/.test(title)
          ? 3
          : 2,
    status:
      p === 0 ? "Completada" : p === 1 && i < 2 ? "En progreso" : "Pendiente",
    owner: ["Ana García", "Carlos Ruiz", "Mariana López", "Diego Torres"][
      i % 4
    ],
    day: [-60, -30, -14, -7, 0, 3][p],
  })),
);
export const criteria = [
  ["Concepto", 10],
  ["Uso de temática", 10],
  ["Mecánicas", 5],
  ["Dinámicas", 5],
  ["Estéticas", 5],
  ["Diseño de nivel", 5],
  ["UX", 5],
  ["UI", 5],
  ["Rejugabilidad", 10],
  ["Visual", 5],
  ["Auditiva", 5],
  ["Narrativa", 5],
  ["Ambientación", 5],
  ["Programación", 10],
  ["Controles / Periféricos", 10],
  ["Nuevas tecnologías", 5],
  ["Nuevos procesos", 5],
  ["Potencial económico", 2],
  ["Potencial empresa", 2],
  ["Propiedad intelectual", 2],
  ["Diversificadores", 4],
] as const;
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
