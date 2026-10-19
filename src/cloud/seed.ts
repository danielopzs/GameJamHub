import { initialTasks } from "../data";
import type { Dataset } from "./types";
export function createSeed(
  name: string,
  email: string,
  fullName: string,
  previous?: Dataset,
): Dataset {
  const date = new Date(Date.now() + 60 * 86400000);
  date.setHours(17, 0, 0, 0);
  const end = new Date(date.getTime() + 48 * 3600000);
  const local = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  const host = previous?.["gj-host"] || {
    name: fullName || email,
    email,
    organization: "Mi organización",
    venue: "Por confirmar",
    sponsors: "",
  };
  return {
    "gj-event": {
      name,
      start: local(date),
      end: local(end),
      mode: "Presencial",
      venue: "Por confirmar",
      framework: false,
      frameworkName: "",
      vip: false,
    },
    "gj-host": host,
    "gj-hosts": previous?.["gj-hosts"] || [host],
    "gj-tasks": initialTasks.map((t) => ({
      ...t,
      status: "Pendiente",
      owner: fullName || email,
    })),
    "gj-members": [
      {
        name: fullName || email,
        email,
        role: "Director General / Líder del Jam",
        color: "purple",
      },
    ],
    "gj-teams": [],
    "gj-participants": [],
    "gj-weight": 85,
  };
}
