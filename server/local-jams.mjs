import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { createLocalPortals } from "./local-portals.mjs";
import { promisify } from "node:util";
import taskTemplate from "../shared/task-template.json" with { type: "json" };

const scrypt = promisify(scryptCallback);
const digest = (value) => createHash("sha256").update(value).digest("hex");
export const jamKey = (name) =>
  String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
const editionValue = (value) => {
  const edition = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  requireValue(edition.length <= 60, "La edición admite hasta 60 caracteres.");
  return edition;
};
const eventKey = (name, edition = "") =>
  edition ? JSON.stringify([jamKey(name), jamKey(edition)]) : jamKey(name);
const cleanName = (name) =>
  String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
function validateJam(name) {
  const value = cleanName(name);
  requireValue(
    value.length >= 2 && value.length <= 150,
    "Escribe un nombre de jam de 2 a 150 caracteres.",
  );
  return value;
}
function answersFrom(value, complete = false) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "Respuestas inválidas.",
  );
  const answers = {};
  for (const key of [
    "mode",
    "start",
    "end",
    "planningStart",
    "studentName",
    "venue",
    "universityRelation",
    "frameworkName",
    "platform",
    "partnerName",
    "civilName",
  ])
    if (typeof value[key] === "string")
      answers[key] = value[key].trim().slice(0, 250);
  for (const key of [
    "university",
    "student",
    "framework",
    "infrastructure",
    "partner",
    "civil",
  ])
    if (typeof value[key] === "boolean") answers[key] = value[key];
  for (const key of ["participants", "teamSize"])
    if (value[key] !== "" && value[key] !== undefined) {
      requireValue(
        Number.isInteger(Number(value[key])) &&
          Number(value[key]) > 0 &&
          Number(value[key]) <= 10000,
        "Indica una cantidad entera entre 1 y 10000.",
      );
      answers[key] = Number(value[key]);
    }
  if (answers.mode === "Virtual") {
    delete answers.venue;
    delete answers.university;
    delete answers.universityRelation;
  } else if (answers.mode === "Presencial") delete answers.platform;
  if (answers.university === false) delete answers.universityRelation;
  if (answers.framework === false) delete answers.frameworkName;
  if (answers.partner === false) delete answers.partnerName;
  if (answers.civil === false) delete answers.civilName;
  if (value.crew !== undefined) {
    requireValue(
      Array.isArray(value.crew) && value.crew.length <= 9,
      "Agrega hasta 9 integrantes además del organizador.",
    );
    const emails = new Set();
    answers.crew = value.crew.map((member) => {
      const name = cleanName(member.name),
        email = String(member.email || "")
          .trim()
          .toLowerCase(),
        role = cleanName(member.role);
      requireValue(
        name.length >= 2 &&
          name.length <= 120 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
          email.length <= 254 &&
          role.length > 0 &&
          role.length <= 120,
        "Completa nombre, correo y rol de cada integrante.",
      );
      requireValue(!emails.has(email), "No repitas correos en el equipo.");
      emails.add(email);
      return {
        name,
        email,
        role,
        color: ["blue", "purple", "pink", "orange"][emails.size % 4],
      };
    });
  }
  if (answers.student === false) delete answers.studentName;
  if (
    (complete && (answers.start || answers.end)) ||
    (answers.start && answers.end)
  ) {
    const start = Date.parse(answers.start),
      end = Date.parse(answers.end),
      planning = Date.parse(answers.planningStart);
    requireValue(
      Number.isFinite(start) && Number.isFinite(end) && end > start,
      "La fecha de fin debe ser posterior al inicio.",
    );
    requireValue(
      !answers.planningStart ||
        (Number.isFinite(planning) && planning <= start),
      "La planeación debe comenzar antes del evento.",
    );
  }
  if (complete) {
    requireValue(
      ["Virtual", "Presencial", "Híbrido"].includes(answers.mode),
      "Selecciona la modalidad.",
    );
    if (answers.mode !== "Virtual") {
      requireValue(!!answers.venue, "Indica dónde harás el game jam.");
      requireValue(
        typeof answers.university === "boolean",
        "Indica si la sede es una universidad.",
      );
      if (answers.university)
        requireValue(
          ["Patrocinio", "Anfitrión", "Acuerdo", "Espacio pagado"].includes(
            answers.universityRelation,
          ),
          "Selecciona la relación con la universidad.",
        );
    }
    if (answers.mode !== "Presencial")
      requireValue(!!answers.platform, "Indica la plataforma del evento.");
    if (answers.student)
      requireValue(!!answers.studentName, "Indica la asociación estudiantil.");
    for (const key of ["framework", "infrastructure", "partner", "civil"])
      requireValue(
        typeof answers[key] === "boolean",
        "Completa todas las preguntas.",
      );
    if (answers.framework)
      requireValue(
        !!answers.frameworkName,
        "Indica el nombre del evento marco.",
      );
    if (answers.partner)
      requireValue(!!answers.partnerName, "Indica quién es tu socio clave.");
    if (answers.civil)
      requireValue(!!answers.civilName, "Indica el grupo o sociedad civil.");
    requireValue(
      !!answers.participants && !!answers.teamSize,
      "Completa participantes y tamaño del equipo.",
    );
  }
  return answers;
}
export function createLocalJams(db) {
  db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS local_organizers(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,credential_type TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS local_jams(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,owner_id TEXT REFERENCES local_organizers(id),onboarded INTEGER NOT NULL DEFAULT 0,answers TEXT NOT NULL DEFAULT '{}',answers_revision INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS local_jam_state(jam_id TEXT NOT NULL REFERENCES local_jams(id),key TEXT NOT NULL,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(jam_id,key));
 CREATE TABLE IF NOT EXISTS local_sessions(token_hash TEXT PRIMARY KEY,organizer_id TEXT NOT NULL REFERENCES local_organizers(id),jam_id TEXT NOT NULL REFERENCES local_jams(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY,jam_id TEXT NOT NULL);
 `);
  if (
    !db
      .prepare("PRAGMA table_info(local_jams)")
      .all()
      .some((c) => c.name === "edition")
  )
    db.exec(
      "ALTER TABLE local_jams ADD COLUMN edition TEXT NOT NULL DEFAULT ''",
    );
  db.exec(`CREATE TABLE IF NOT EXISTS local_access(jam_id TEXT NOT NULL REFERENCES local_jams(id),user_id TEXT NOT NULL REFERENCES local_organizers(id),role TEXT NOT NULL CHECK(role IN ('judge','participant','staff')),PRIMARY KEY(jam_id,user_id));
  CREATE TABLE IF NOT EXISTS local_scorecards(jam_id TEXT NOT NULL REFERENCES local_jams(id),user_id TEXT NOT NULL REFERENCES local_organizers(id),team_code TEXT NOT NULL,scores TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(jam_id,user_id,team_code));`);
  // Additive upgrade: keep the original state table intact and copy its one event once.
  if (
    !db
      .prepare("SELECT name FROM local_migrations WHERE name='legacy-state-v1'")
      .get()
  ) {
    const rows = db.prepare("SELECT key,value FROM state").all();
    if (rows.length) {
      let previous = {};
      try {
        previous = JSON.parse(
          rows.find((r) => r.key === "gj-event")?.value || "{}",
        );
      } catch {}
      const name = cleanName(previous.name) || "Mi jam anterior";
      const id = randomUUID();
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          "INSERT INTO local_jams(id,name,name_key) VALUES(?,?,?)",
        ).run(id, name, jamKey(name));
        const insert = db.prepare(
          "INSERT INTO local_jam_state(jam_id,key,value) VALUES(?,?,?)",
        );
        for (const row of rows) insert.run(id, row.key, row.value);
        db.prepare("INSERT INTO local_migrations VALUES(?,?)").run(
          "legacy-state-v1",
          id,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  const allowedKeys = new Set([
    "gj-event",
    "gj-host",
    "gj-hosts",
    "gj-tasks",
    "gj-members",
    "gj-teams",
    "gj-judges",
    "gj-evaluations",
    "gj-weight",
    "gj-participants",
    "gj-prizes",
    "gj-reminders",
    "gj-registration-capacity",
  ]);
  const failures = new Map();
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      db.exec("COMMIT");
      return value;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function jamInfo(row) {
    return {
      id: row.id,
      name: row.name,
      edition: row.edition || "",
      createdAt: row.created_at.replace(" ", "T") + "Z",
      onboarded: !!row.onboarded,
      answers: JSON.parse(row.answers),
      answersRevision: row.answers_revision,
    };
  }
  function profile(row) {
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      role: row.role || "organizer",
    };
  }
  function session(req) {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("gj_session="))
      ?.slice(11);
    if (!raw) return portals.ticketSession(req);
    return (
      db
        .prepare(
          "SELECT s.jam_id,u.*,CASE WHEN j.owner_id=u.id THEN 'organizer' ELSE a.role END AS role FROM local_sessions s JOIN local_organizers u ON u.id=s.organizer_id JOIN local_jams j ON j.id=s.jam_id LEFT JOIN local_access a ON a.jam_id=j.id AND a.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND (j.owner_id=u.id OR a.user_id IS NOT NULL)",
        )
        .get(digest(raw), Date.now()) || portals.ticketSession(req)
    );
  }
  function owner(req, id) {
    const user = session(req);
    requireValue(!!user && !user.ticket, "Inicia sesión para continuar.", 401);
    const jam = db
      .prepare("SELECT * FROM local_jams WHERE id=? AND owner_id=?")
      .get(id, user.id);
    requireValue(!!jam, "No tienes acceso a este jam.", 403);
    return { user, jam };
  }
  function setCookie(res, userId, jamId) {
    const token = randomBytes(32).toString("hex");
    const lifetime = 12 * 3600;
    db.prepare("DELETE FROM local_sessions WHERE expires_at<=?").run(
      Date.now(),
    );
    db.prepare("INSERT INTO local_sessions VALUES(?,?,?,?)").run(
      digest(token),
      userId,
      jamId,
      Date.now() + lifetime * 1000,
    );
    res.setHeader(
      "Set-Cookie",
      `gj_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${lifetime}${process.env.COOKIE_SECURE === "1" ? "; Secure" : ""}`,
    );
  }
  function getValue(id, key, fallback) {
    const row = db
      .prepare("SELECT value FROM local_jam_state WHERE jam_id=? AND key=?")
      .get(id, key);
    return row ? JSON.parse(row.value) : fallback;
  }
  function putValue(id, key, value) {
    db.prepare(
      "INSERT INTO local_jam_state(jam_id,key,value) VALUES(?,?,?) ON CONFLICT(jam_id,key) DO UPDATE SET value=excluded.value,revision=local_jam_state.revision+1",
    ).run(id, key, JSON.stringify(value));
  }
  function seed(jam, user, answers) {
    const settings = getValue(jam.id, "gj-event", {
      name: jam.name,
      start: "",
      end: "",
      vip: false,
    });
    putValue(jam.id, "gj-event", {
      ...settings,
      name: jam.name,
      edition: jam.edition || "",
      start: answers.start || settings.start,
      end: answers.end || settings.end,
      planningStart:
        answers.planningStart ||
        settings.planningStart ||
        jam.created_at.replace(" ", "T") + "Z",
      platform: answers.platform || "",
      mode: answers.mode,
      venue: answers.mode === "Virtual" ? answers.platform : answers.venue,
      framework: answers.framework,
      frameworkName: answers.frameworkName || "",
    });
    const host = getValue(jam.id, "gj-host", {
      name: user.name,
      email: user.email,
      organization: "",
      venue: answers.venue || "",
      sponsors: answers.partnerName || "",
    });
    const defaults = {
      "gj-host": host,
      "gj-hosts": [host],
      "gj-tasks": taskTemplate.map((task) => ({
        ...task,
        title: task.title.includes("Contratar ambulancia")
          ? "Consultar con la sede la necesidad de servicio médico o ambulancia"
          : task.title,
        status: "Pendiente",
        owner: user.name,
      })),
      "gj-members": [
        {
          name: user.name,
          email: user.email,
          role: "Director General / Líder del Jam",
          color: "purple",
        },
      ],
      "gj-teams": [],
      "gj-judges": [],
      "gj-evaluations": {},
      "gj-weight": 85,
      "gj-participants": [],
      "gj-prizes": [],
      "gj-reminders": [],
      "gj-registration-capacity": Math.min(100, answers.participants || 100),
    };
    for (const [key, value] of Object.entries(defaults))
      if (
        !db
          .prepare("SELECT key FROM local_jam_state WHERE jam_id=? AND key=?")
          .get(jam.id, key)
      )
        putValue(jam.id, key, value);
    if (answers.crew?.length) {
      const members = getValue(jam.id, "gj-members", []);
      for (const member of answers.crew)
        if (!members.some((m) => m.email.toLowerCase() === member.email))
          members.push(member);
      requireValue(members.length <= 10, "El comité admite hasta 10 personas.");
      putValue(jam.id, "gj-members", members);
    }
  }
  function validateState(key, value) {
    requireValue(allowedKeys.has(key), "Colección desconocida.", 404);
    requireValue(value !== undefined, "Falta el valor.");
    if (
      [
        "gj-hosts",
        "gj-tasks",
        "gj-members",
        "gj-teams",
        "gj-judges",
        "gj-participants",
        "gj-prizes",
        "gj-reminders",
      ].includes(key)
    )
      requireValue(Array.isArray(value), "Se esperaba una lista.");
    if (["gj-event", "gj-host", "gj-evaluations"].includes(key))
      requireValue(
        value && typeof value === "object" && !Array.isArray(value),
        "Se esperaba un objeto.",
      );
    if (key === "gj-event") {
      validateJam(value.name);
      editionValue(value.edition);
      if (value.start || value.end)
        requireValue(
          Number.isFinite(Date.parse(value.start)) &&
            Date.parse(value.end) > Date.parse(value.start),
          "Revisa inicio y fin del evento.",
        );
      if (value.planningStart)
        requireValue(
          Number.isFinite(Date.parse(value.planningStart)) &&
            Date.parse(value.planningStart) <= Date.parse(value.start),
          "La planeación debe comenzar antes del evento.",
        );
    }
    if (key === "gj-registration-capacity")
      requireValue(
        Number.isInteger(value) && value > 0 && value <= 100,
        "El cupo debe ser entre 1 y 100.",
      );
    if (key === "gj-prizes")
      for (const p of value)
        requireValue(
          typeof p.id === "string" &&
            String(p.name || "").trim() &&
            Number.isFinite(p.value) &&
            p.value >= 0 &&
            Number.isInteger(p.quantity) &&
            p.quantity > 0 &&
            [0, 1, 2, 3].includes(p.place) &&
            ["Propuesto", "Confirmado", "Entregado"].includes(p.status),
          "Revisa nombre, valor, cantidad, posición y estado del premio.",
        );
    if (key === "gj-reminders")
      for (const r of value)
        requireValue(
          typeof r.id === "string" &&
            String(r.text || "").trim() &&
            String(r.text).length <= 500 &&
            Number.isFinite(Date.parse(r.at)) &&
            ["Todos", "Organizadores", "Jueces", "Participantes"].includes(
              r.audience,
            ) &&
            ["critical", "action", "info"].includes(r.level),
          "Revisa destinatario, nivel, fecha y mensaje del recordatorio.",
        );
    if (key === "gj-members")
      requireValue(value.length <= 10, "Máximo 10 integrantes.");
    if (key === "gj-judges")
      requireValue(value.length <= 5, "Máximo 5 jueces.");
    if (key === "gj-teams")
      for (const t of value)
        if (t.submission)
          requireValue(
            /^https?:\/\//i.test(t.submission),
            "La entrega debe ser un enlace HTTP o HTTPS.",
          );
    if (key === "gj-weight")
      requireValue(
        Number.isFinite(value) && value >= 0 && value <= 100,
        "Ponderación inválida.",
      );
    if (key === "gj-participants")
      requireValue(
        value.length <= 100,
        "Máximo 100 participantes registrados por evento.",
      );
  }
  function allScores(id) {
    const values = getValue(id, "gj-evaluations", {});
    for (const row of db
      .prepare(
        "SELECT u.name,s.user_id,s.team_code,s.scores FROM local_scorecards s JOIN local_organizers u ON u.id=s.user_id WHERE s.jam_id=?",
      )
      .all(id)) {
      delete values[`${row.name}:${row.team_code}`];
      values[`${row.user_id}:${row.team_code}`] = JSON.parse(row.scores);
    }
    return values;
  }
  const portals = createLocalPortals({
    db,
    session,
    owner,
    profile,
    jamInfo,
    getValue,
    putValue,
    transaction,
    requireValue,
  });
  async function handle(req, res, path, body, reply) {
    if (!path.startsWith("/api/local/") && !path.startsWith("/api/state/"))
      return false;
    try {
      if (await portals.handle(req, res, path, body, reply)) return true;
      if (path === "/api/local/lookup" && req.method === "POST") {
        const { name, edition: inputEdition } = await body(req);
        const edition = editionValue(inputEdition);
        const display = validateJam(name);
        const row = db
          .prepare("SELECT * FROM local_jams WHERE name_key=?")
          .get(eventKey(display, edition));
        reply(
          res,
          200,
          row
            ? {
                exists: true,
                id: row.id,
                name: row.name,
                edition: row.edition,
                needsOwner: !row.owner_id,
              }
            : { exists: false, name: display, edition },
        );
        return true;
      }
      if (path === "/api/local/register" && req.method === "POST") {
        const data = await body(req);
        const name = validateJam(data.jamName);
        const edition = editionValue(data.edition);
        const fullName = cleanName(data.name);
        const username = String(data.username || "")
          .trim()
          .toLowerCase();
        const email = String(data.email || "")
          .trim()
          .toLowerCase();
        const password = String(data.password || "");
        const kind = data.credentialType === "pin" ? "pin" : "password";
        requireValue(
          fullName.length >= 2 && fullName.length <= 120,
          "Escribe tu nombre completo.",
        );
        requireValue(
          /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username),
          "El usuario debe tener de 3 a 32 letras, números, puntos, guiones o guiones bajos.",
        );
        requireValue(
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254,
          "Escribe un correo válido.",
        );
        requireValue(
          kind === "pin"
            ? /^\d{6,12}$/.test(password)
            : password.length >= 8 && password.length <= 128,
          kind === "pin"
            ? "El PIN debe contener de 6 a 12 dígitos."
            : "La contraseña debe tener de 8 a 128 caracteres.",
        );
        const salt = randomBytes(16).toString("hex");
        const derived = await scrypt(password, salt, 64);
        const passwordHash = `scrypt:${salt}:${derived.toString("hex")}`;
        const result = transaction(() => {
          const previous = db
            .prepare("SELECT * FROM local_jams WHERE name_key=?")
            .get(eventKey(name, edition));
          requireValue(
            !previous?.owner_id,
            "Este jam ya tiene organizador. Inicia sesión.",
            409,
          );
          requireValue(
            !db
              .prepare(
                "SELECT id FROM local_organizers WHERE username=? OR email=?",
              )
              .get(username, email),
            "El usuario o correo ya está registrado. Usa «Ya tengo cuenta».",
            409,
          );
          const id = randomUUID();
          db.prepare("INSERT INTO local_organizers VALUES(?,?,?,?,?,?)").run(
            id,
            fullName,
            username,
            email,
            passwordHash,
            kind,
          );
          let jamId = previous?.id;
          if (previous)
            db.prepare(
              "UPDATE local_jams SET owner_id=? WHERE id=? AND owner_id IS NULL",
            ).run(id, jamId);
          else {
            jamId = randomUUID();
            db.prepare(
              "INSERT INTO local_jams(id,name,name_key,owner_id,edition) VALUES(?,?,?,?,?)",
            ).run(jamId, name, eventKey(name, edition), id, edition);
          }
          return {
            user: db
              .prepare("SELECT * FROM local_organizers WHERE id=?")
              .get(id),
            jam: db.prepare("SELECT * FROM local_jams WHERE id=?").get(jamId),
          };
        });
        setCookie(res, result.user.id, result.jam.id);
        reply(res, 201, {
          user: profile(result.user),
          jam: jamInfo(result.jam),
        });
        return true;
      }
      if (path === "/api/local/login" && req.method === "POST") {
        const data = await body(req);
        const name = validateJam(data.jamName);
        const edition = editionValue(data.edition);
        const identity = String(data.identifier || "")
          .trim()
          .toLowerCase();
        const rateKey = `${req.socket.remoteAddress}:${eventKey(name, edition)}:${identity}`;
        const failure = failures.get(rateKey);
        requireValue(
          !failure || failure.count < 5 || failure.until < Date.now(),
          "Demasiados intentos. Espera 15 minutos antes de reintentar.",
          429,
        );
        const user = db
          .prepare("SELECT * FROM local_organizers WHERE username=? OR email=?")
          .get(identity, identity);
        const [, salt, hash] = user?.password_hash?.split(":") || [
          "",
          "invalid-salt",
          "0".repeat(128),
        ];
        const derived = await scrypt(
          String(data.password || "").slice(0, 128),
          salt,
          64,
        );
        let jam = db
          .prepare("SELECT * FROM local_jams WHERE name_key=?")
          .get(eventKey(name, edition));
        const grant =
          user && jam
            ? db
                .prepare(
                  "SELECT role FROM local_access WHERE jam_id=? AND user_id=?",
                )
                .get(jam.id, user.id)
            : null;
        if (
          !user ||
          !timingSafeEqual(derived, Buffer.from(hash, "hex")) ||
          (jam &&
            jam.owner_id !== user.id &&
            !grant &&
            !(!jam.owner_id && data.create)) ||
          (!jam && !data.create)
        ) {
          failures.set(rateKey, {
            count:
              failure && failure.until > Date.now() ? failure.count + 1 : 1,
            until: Date.now() + 15 * 60000,
          });
          if (failures.size > 10000)
            for (const [k, v] of failures)
              if (v.until < Date.now()) failures.delete(k);
          throw new HttpError(
            401,
            "El usuario o la contraseña/PIN no corresponden a un acceso de esta edición.",
          );
        }
        if (!jam?.owner_id)
          jam = transaction(() => {
            const existing = db
              .prepare("SELECT * FROM local_jams WHERE name_key=?")
              .get(eventKey(name, edition));
            requireValue(
              !existing?.owner_id,
              "El jam acaba de ser registrado. Vuelve a buscarlo.",
              409,
            );
            requireValue(
              db
                .prepare(
                  "SELECT count(*) AS count FROM local_jams WHERE owner_id=?",
                )
                .get(user.id).count < 6,
              "Esta versión admite hasta seis eventos por organizador.",
            );
            const id = existing?.id || randomUUID();
            if (existing)
              db.prepare("UPDATE local_jams SET owner_id=? WHERE id=?").run(
                user.id,
                id,
              );
            else
              db.prepare(
                "INSERT INTO local_jams(id,name,name_key,owner_id,edition) VALUES(?,?,?,?,?)",
              ).run(id, name, eventKey(name, edition), user.id, edition);
            return db.prepare("SELECT * FROM local_jams WHERE id=?").get(id);
          });
        failures.delete(rateKey);
        setCookie(res, user.id, jam.id);
        reply(res, 200, {
          user: profile({ ...user, role: grant?.role || "organizer" }),
          jam: grant ? { ...jamInfo(jam), answers: {} } : jamInfo(jam),
        });
        return true;
      }
      if (path === "/api/local/logout" && req.method === "POST") {
        const raw = (req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("gj_session="))
          ?.slice(11);
        if (raw)
          db.prepare("DELETE FROM local_sessions WHERE token_hash=?").run(
            digest(raw),
          );
        res.setHeader(
          "Set-Cookie",
          "gj_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        );
        reply(res, 200, { ok: true });
        return true;
      }
      const match = path.match(
        /^\/api\/local\/jams\/([^/]+)(?:\/(onboarding|state)(?:\/([^/]+))?)?$/,
      );
      if (match) {
        const id = match[1];
        const { user, jam } = owner(req, id);
        if (!match[2] && req.method === "GET") {
          reply(res, 200, {
            user: profile(user),
            jam: jamInfo(jam),
            state: db
              .prepare(
                "SELECT key,value,revision FROM local_jam_state WHERE jam_id=?",
              )
              .all(id)
              .map((r) => ({
                ...r,
                value:
                  r.key === "gj-evaluations"
                    ? allScores(id)
                    : JSON.parse(r.value),
              }))
              .concat([
                {
                  key: "gj-auth-judges",
                  value: db
                    .prepare(
                      "SELECT u.name FROM local_access a JOIN local_organizers u ON u.id=a.user_id WHERE a.jam_id=? AND a.role='judge'",
                    )
                    .all(id)
                    .map((u) => u.name),
                  revision: 0,
                },
              ]),
          });
          return true;
        }
        if (match[2] === "onboarding" && req.method === "PUT") {
          const data = await body(req);
          const answers = answersFrom(data.answers, !!data.complete);
          const updated = transaction(() => {
            const current = db
              .prepare("SELECT * FROM local_jams WHERE id=?")
              .get(id);
            requireValue(
              data.revision === current.answers_revision,
              "Otra sesión modificó el cuestionario. Recarga para recuperar la versión guardada.",
              409,
            );
            if (data.complete) seed(current, user, answers);
            db.prepare(
              "UPDATE local_jams SET answers=?,answers_revision=answers_revision+1,onboarded=? WHERE id=?",
            ).run(
              JSON.stringify(answers),
              data.complete ? 1 : current.onboarded,
              id,
            );
            return db.prepare("SELECT * FROM local_jams WHERE id=?").get(id);
          });
          reply(res, 200, { jam: jamInfo(updated) });
          return true;
        }
        if (match[2] === "state" && match[3] && req.method === "PUT") {
          requireValue(
            !!jam.onboarded,
            "Completa primero las preguntas del evento.",
            409,
          );
          const key = decodeURIComponent(match[3]);
          const data = await body(req);
          validateState(key, data.value);
          const revision = transaction(() => {
            const row = db
              .prepare(
                "SELECT revision FROM local_jam_state WHERE jam_id=? AND key=?",
              )
              .get(id, key);
            requireValue(
              data.revision === (row?.revision || 0),
              "CONFLICT: otra sesión cambió estos datos. Descarga el borrador y recarga antes de continuar.",
              409,
            );
            if (key === "gj-event") {
              const name = validateJam(data.value.name);
              const edition = editionValue(data.value.edition ?? jam.edition);
              requireValue(
                !db
                  .prepare(
                    "SELECT id FROM local_jams WHERE name_key=? AND id<>?",
                  )
                  .get(eventKey(name, edition), id),
                "Ya existe otro jam con ese nombre.",
                409,
              );
              db.prepare(
                "UPDATE local_jams SET name=?,name_key=?,edition=? WHERE id=?",
              ).run(name, eventKey(name, edition), edition, id);
            }
            putValue(id, key, data.value);
            return db
              .prepare(
                "SELECT revision FROM local_jam_state WHERE jam_id=? AND key=?",
              )
              .get(id, key).revision;
          });
          reply(res, 200, { revision });
          return true;
        }
      }
      if (path.startsWith("/api/state/")) {
        requireValue(
          !!session(req),
          "Inicia sesión para acceder a los datos del evento.",
          401,
        );
        reply(res, 410, { error: "Usa la API de datos del jam seleccionado." });
        return true;
      }
      reply(res, 404, { error: "Ruta local no encontrada." });
      return true;
    } catch (e) {
      if (e instanceof HttpError) {
        reply(res, e.status, { error: e.message });
        return true;
      }
      if (e.code?.startsWith("SQLITE_CONSTRAINT")) {
        reply(res, 409, {
          error: "El usuario, correo o nombre del jam ya está registrado.",
        });
        return true;
      }
      throw e;
    }
  }
  return { handle, session, owner };
}
