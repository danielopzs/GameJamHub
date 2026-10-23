import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import { memberRoles } from "../shared/event-profile.mjs";
import { eventReminders } from "../shared/planning.mjs";
const scrypt = promisify(scryptCallback),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const limits = [
  10, 10, 5, 5, 5, 5, 5, 5, 10, 5, 5, 5, 5, 10, 10, 5, 5, 2, 2, 2, 4,
];
const audience = (role) =>
  role === "judge"
    ? "Jueces"
    : role === "staff"
      ? "Organizadores"
      : "Participantes";
export function createLocalPortals({
  db,
  session,
  owner,
  profile,
  jamInfo,
  getValue,
  putValue,
  transaction,
  requireValue,
}) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS local_tickets(token_hash TEXT PRIMARY KEY,jam_id TEXT NOT NULL REFERENCES local_jams(id),participant_id TEXT NOT NULL)",
  );
  function publicEvent(id) {
    const jam = db
      .prepare("SELECT * FROM local_jams WHERE id=? AND onboarded=1")
      .get(id);
    requireValue(!!jam, "No encontramos esta edición.", 404);
    const e = getValue(id, "gj-event", {});
    return {
      jam,
      event: {
        name: jam.name,
        edition: jam.edition,
        start: e.start,
        end: e.end,
        mode: e.mode,
        venue: e.venue,
        platform: e.platform,
        joinUrl:
          e.mode === "Virtual" || e.mode === "Híbrido" ? e.joinUrl || "" : "",
        frameworkName: e.frameworkName,
        registrationOpen: !!e.registrationOpen,
      },
    };
  }
  function ticketRecord(token) {
    const record = db
      .prepare("SELECT * FROM local_tickets WHERE token_hash=?")
      .get(hash(String(token || "")));
    requireValue(!!record, "Comprobante no encontrado.", 404);
    const person = getValue(record.jam_id, "gj-participants", []).find(
      (p) => p.id === record.participant_id,
    );
    requireValue(!!person, "La inscripción ya no está activa.", 404);
    return { record, person };
  }
  function ticketSession(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("gj_ticket="))
      ?.slice(10);
    if (!token) return null;
    try {
      const { record, person } = ticketRecord(token);
      return {
        ...person,
        jam_id: record.jam_id,
        role: "participant",
        ticket: true,
      };
    } catch {
      return null;
    }
  }
  function guest(req, id) {
    const user = session(req);
    requireValue(
      user && !user.ticket && user.jam_id === id,
      "Inicia sesión en esta edición.",
      401,
    );
    return user;
  }
  function notices(id, role) {
    return eventReminders(
      getValue(id, "gj-event", {}),
      getValue(id, "gj-reminders", []),
    ).filter((r) => r.audience === "Todos" || r.audience === audience(role));
  }
  function guestData(id, user) {
    const { event, jam } = publicEvent(id);
    return {
      user: profile(user),
      jam: { id: jam.id, name: jam.name, edition: jam.edition },
      event,
      teams: getValue(id, "gj-teams", []).map((t) => ({
        code: t.code,
        name: t.name,
        game: t.game,
        time: t.time,
        submission: t.submission || "",
        submitted: !!t.submitted,
      })),
      tasks: user.role === "staff" ? getValue(id, "gj-tasks", []) : [],
      members:
        user.role === "staff"
          ? getValue(id, "gj-members", []).map((m) => ({
              name: m.name,
              role: m.role,
              roles: memberRoles(m),
            }))
          : [],
      scorecards: db
        .prepare(
          "SELECT team_code AS teamCode,scores,revision FROM local_scorecards WHERE jam_id=? AND user_id=?",
        )
        .all(id, user.id)
        .map((r) => ({ ...r, scores: JSON.parse(r.scores) })),
      reminders: notices(id, user.role),
    };
  }
  async function handle(req, res, path, body, reply) {
    const publicMatch = path.match(/^\/api\/local\/public\/([^/]+)$/);
    if (publicMatch) {
      const id = publicMatch[1],
        { event } = publicEvent(id);
      requireValue(
        event.registrationOpen,
        "Las inscripciones de esta edición están cerradas.",
        403,
      );
      const people = getValue(id, "gj-participants", []);
      const capacity = Math.min(
        100,
        Number(getValue(id, "gj-registration-capacity", 100)) || 100,
      );
      if (req.method === "GET") {
        reply(res, 200, {
          event,
          capacity,
          registered: people.length,
          remaining: Math.max(0, capacity - people.length),
        });
        return true;
      }
      if (req.method === "POST") {
        const data = await body(req),
          name = String(data.name || "").trim(),
          email = String(data.email || "")
            .trim()
            .toLowerCase(),
          teamCode = String(data.teamCode || "").trim();
        requireValue(
          !data.website &&
            name.length >= 2 &&
            name.length <= 120 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
            email.length <= 254,
          "Escribe tu nombre y un correo válido.",
        );
        requireValue(
          people.length < capacity,
          "Se agotaron los lugares disponibles.",
          409,
        );
        requireValue(
          !people.some((p) => p.email.toLowerCase() === email),
          "Ya existe una inscripción con ese correo. Solicita tu comprobante al organizador.",
          409,
        );
        requireValue(
          !teamCode ||
            getValue(id, "gj-teams", []).some((t) => t.code === teamCode),
          "El código de equipo no existe. Puedes dejarlo vacío y asignarlo después.",
        );
        const token = randomBytes(32).toString("hex"),
          person = {
            id: randomUUID(),
            name,
            email,
            teamCode,
            checkedIn: false,
            ticketCode: randomBytes(5).toString("hex").toUpperCase(),
            registeredAt: new Date().toISOString(),
            source: "autoregistro",
          };
        transaction(() => {
          const current = getValue(id, "gj-participants", []);
          requireValue(
            getValue(id, "gj-event", {}).registrationOpen,
            "Las inscripciones están cerradas.",
            403,
          );
          requireValue(
            current.length <
              Math.min(
                100,
                Number(getValue(id, "gj-registration-capacity", 100)) || 100,
              ),
            "Se agotaron los lugares disponibles.",
            409,
          );
          requireValue(
            !current.some((p) => String(p.email || "").toLowerCase() === email),
            "Ya existe una inscripción con ese correo.",
            409,
          );
          putValue(id, "gj-participants", [...current, person]);
          db.prepare("INSERT INTO local_tickets VALUES(?,?,?)").run(
            hash(token),
            id,
            person.id,
          );
        });
        reply(res, 201, { token, ticketCode: person.ticketCode });
        return true;
      }
    }
    if (path === "/api/local/ticket" && req.method === "POST") {
      const { token } = await body(req),
        { record, person } = ticketRecord(token),
        { event } = publicEvent(record.jam_id);
      res.setHeader(
        "Set-Cookie",
        `gj_ticket=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${process.env.COOKIE_SECURE === "1" ? "; Secure" : ""}`,
      );
      reply(res, 200, {
        person,
        event,
        reminders: notices(record.jam_id, "participant"),
      });
      return true;
    }
    const match = path.match(
      /^\/api\/local\/jams\/([^/]+)\/(access|portal|scorecards|tickets|tasks)(?:\/([^/]+))?$/,
    );
    if (!match) return false;
    const [, id, section, item] = match;
    if (section === "portal" && req.method === "GET") {
      const user = guest(req, id);
      requireValue(
        ["judge", "participant", "staff"].includes(user.role),
        "Usa el dashboard del organizador.",
        403,
      );
      reply(res, 200, guestData(id, user));
      return true;
    }
    if (section === "tasks" && item && req.method === "PUT") {
      const user = guest(req, id);
      requireValue(
        user.role === "staff",
        "Solo el comité puede actualizar estas tareas.",
        403,
      );
      const data = await body(req);
      requireValue(
        ["Pendiente", "En progreso", "Completada"].includes(data.status) &&
          getValue(id, "gj-members", []).some((m) => m.name === data.owner),
        "Selecciona un estado y un responsable del comité.",
      );
      transaction(() => {
        const tasks = getValue(id, "gj-tasks", []),
          task = tasks.find((t) => String(t.id) === item);
        requireValue(!!task, "Tarea no encontrada.", 404);
        requireValue(
          data.expected?.owner === task.owner &&
            data.expected?.status === task.status,
          "Alguien cambió esta tarea. Recarga antes de guardar.",
          409,
        );
        putValue(
          id,
          "gj-tasks",
          tasks.map((t) =>
            t.id === task.id
              ? { ...t, status: data.status, owner: data.owner }
              : t,
          ),
        );
      });
      reply(res, 200, { ok: true });
      return true;
    }
    if (section === "scorecards" && item && req.method === "PUT") {
      const user = guest(req, id);
      requireValue(
        user.role === "judge",
        "Solo el jurado puede evaluar aquí.",
        403,
      );
      const code = decodeURIComponent(item);
      requireValue(
        getValue(id, "gj-teams", []).some((t) => t.code === code),
        "Equipo no encontrado.",
        404,
      );
      const data = await body(req);
      requireValue(
        Array.isArray(data.scores) &&
          data.scores.length === limits.length &&
          data.scores.every(
            (v, i) => Number.isFinite(v) && v >= 0 && v <= limits[i],
          ),
        "La rúbrica debe contener 21 valores dentro de sus límites (máximo 120).",
      );
      const revision = transaction(() => {
        const previous = db
          .prepare(
            "SELECT revision FROM local_scorecards WHERE jam_id=? AND user_id=? AND team_code=?",
          )
          .get(id, user.id, code);
        requireValue(
          data.revision === (previous?.revision || 0),
          "Otra sesión cambió tu evaluación. Recarga antes de volver a guardar.",
          409,
        );
        db.prepare(
          "INSERT INTO local_scorecards(jam_id,user_id,team_code,scores) VALUES(?,?,?,?) ON CONFLICT(jam_id,user_id,team_code) DO UPDATE SET scores=excluded.scores,revision=local_scorecards.revision+1",
        ).run(id, user.id, code, JSON.stringify(data.scores));
        return (previous?.revision || 0) + 1;
      });
      reply(res, 200, { revision });
      return true;
    }
    if (section === "tickets" && item && req.method === "POST") {
      owner(req, id);
      const person = getValue(id, "gj-participants", []).find(
        (p) => p.id === item,
      );
      requireValue(!!person, "Participante no encontrado.", 404);
      const token = randomBytes(32).toString("hex");
      transaction(() => {
        db.prepare(
          "DELETE FROM local_tickets WHERE jam_id=? AND participant_id=?",
        ).run(id, item);
        db.prepare("INSERT INTO local_tickets VALUES(?,?,?)").run(
          hash(token),
          id,
          item,
        );
      });
      reply(res, 200, { token });
      return true;
    }
    if (section === "access") {
      owner(req, id);
      if (req.method === "GET") {
        reply(res, 200, {
          access: db
            .prepare(
              "SELECT u.id,u.name,u.username,u.email,a.role FROM local_access a JOIN local_organizers u ON u.id=a.user_id WHERE a.jam_id=?",
            )
            .all(id),
        });
        return true;
      }
      if (req.method === "DELETE" && item) {
        transaction(() => {
          db.prepare(
            "DELETE FROM local_access WHERE jam_id=? AND user_id=?",
          ).run(id, item);
          db.prepare(
            "DELETE FROM local_sessions WHERE jam_id=? AND organizer_id=?",
          ).run(id, item);
        });
        reply(res, 200, { ok: true });
        return true;
      }
      if (req.method === "POST") {
        const data = await body(req),
          name = String(data.name || "").trim(),
          email = String(data.email || "")
            .trim()
            .toLowerCase(),
          username = String(data.username || "")
            .trim()
            .toLowerCase(),
          role = data.role;
        requireValue(
          ["judge", "participant", "staff"].includes(role) &&
            name.length >= 2 &&
            name.length <= 120 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
            /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username),
          "Completa nombre, correo, usuario y tipo de acceso.",
        );
        const existing = db
          .prepare("SELECT * FROM local_organizers WHERE username=? OR email=?")
          .get(username, email);
        requireValue(
          !existing ||
            (existing.email === email && existing.username === username),
          "Ese usuario o correo pertenece a otra cuenta.",
          409,
        );
        const password = String(data.password || "");
        requireValue(
          existing || (password.length >= 8 && password.length <= 128),
          "Usa una contraseña de al menos ocho caracteres.",
        );
        const salt = randomBytes(16).toString("hex"),
          passwordHash = existing
            ? ""
            : `scrypt:${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
        const user = transaction(() => {
          const jam = db
            .prepare("SELECT owner_id FROM local_jams WHERE id=?")
            .get(id);
          requireValue(
            existing?.id !== jam.owner_id,
            "El organizador ya tiene acceso a esta edición.",
          );
          const count = db
            .prepare(
              "SELECT count(*) n FROM local_access WHERE jam_id=? AND role=? AND user_id<>?",
            )
            .get(id, role, existing?.id || "").n;
          requireValue(
            count < (role === "judge" ? 5 : role === "staff" ? 9 : 100),
            "Se alcanzó el límite de accesos para este perfil.",
          );
          if (role === "staff")
            requireValue(
              getValue(id, "gj-members", []).some(
                (m) => m.email.toLowerCase() === email,
              ),
              "Agrega primero el perfil al comité con este mismo correo.",
            );
          const user = existing || { id: randomUUID(), name, email, username };
          if (!existing)
            db.prepare("INSERT INTO local_organizers VALUES(?,?,?,?,?,?)").run(
              user.id,
              name,
              username,
              email,
              passwordHash,
              "password",
            );
          db.prepare(
            "INSERT INTO local_access VALUES(?,?,?) ON CONFLICT(jam_id,user_id) DO UPDATE SET role=excluded.role",
          ).run(id, user.id, role);
          if (role === "judge") {
            const judges = getValue(id, "gj-judges", []);
            if (!judges.includes(user.name)) {
              requireValue(
                judges.length < 5,
                "Máximo cinco jueces entre registros manuales y accesos.",
              );
              putValue(id, "gj-judges", [...judges, user.name]);
            }
          }
          return user;
        });
        reply(res, 201, {
          user: profile({ ...user, role }),
          created: !existing,
        });
        return true;
      }
    }
    return false;
  }
  return { handle, ticketSession };
}
