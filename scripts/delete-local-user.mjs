import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

// Run locally on the machine holding the real SQLite database. Never creates a database.
const selector = process.argv[2]?.trim().toLowerCase();
const filename = resolve(process.env.DATA_DIR || ".data", "gamejam.sqlite");
let db;
try {
  if (!selector || process.argv.length !== 3)
    throw Error("Uso: npm run user:delete -- USUARIO_O_CORREO");
  if (!existsSync(filename)) throw Error(`No existe la base: ${filename}`);
  db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
  const hasTable = (name) =>
    !!db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
  if (!hasTable("local_organizers"))
    throw Error("Esta base no contiene cuentas locales. No se modificó nada.");
  const matches = db
    .prepare(
      `SELECT id,username,email FROM local_organizers
    WHERE credential_type<>'deleted' AND
    (lower(username)=? OR lower(email)=? OR lower(substr(email,1,instr(email,'@')-1))=?)`,
    )
    .all(selector, selector, selector.includes("@") ? "" : selector);
  if (!matches.length)
    throw Error("No se encontró esa cuenta. No se modificó nada.");
  if (matches.length !== 1)
    throw Error(
      "Hay varias coincidencias. Usa el correo completo para identificar una sola cuenta. No se modificó nada.",
    );
  const user = matches[0];
  const directory = join(dirname(filename), "backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = join(
    directory,
    `antes-de-borrar-usuario-${Date.now()}-${randomUUID()}.sqlite`,
  );
  db.prepare("VACUUM INTO ?").run(backup);
  chmodSync(backup, 0o600);
  db.exec("BEGIN IMMEDIATE");
  let detached = 0,
    archived = false;
  try {
    detached = db
      .prepare("UPDATE local_jams SET owner_id=NULL WHERE owner_id=?")
      .run(user.id).changes;
    db.prepare("DELETE FROM local_sessions WHERE organizer_id=?").run(user.id);
    if (hasTable("local_access"))
      db.prepare("DELETE FROM local_access WHERE user_id=?").run(user.id);
    archived =
      hasTable("local_scorecards") &&
      db
        .prepare("SELECT count(*) n FROM local_scorecards WHERE user_id=?")
        .get(user.id).n > 0;
    if (archived) {
      // Keep the author's ID/name so historic scorecards and averages remain unchanged.
      // An unreachable credential releases both unique fields and disables the old login.
      const suffix = randomUUID();
      db.prepare(
        "UPDATE local_organizers SET username=?,email=?,password_hash=?,credential_type='deleted' WHERE id=?",
      ).run(
        `deleted-${suffix}`,
        `deleted-${suffix}@local.invalid`,
        `scrypt:${randomBytes(16).toString("hex")}:${randomBytes(64).toString("hex")}`,
        user.id,
      );
    } else db.prepare("DELETE FROM local_organizers WHERE id=?").run(user.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(`Usuario y correo liberados: ${user.username} · ${user.email}`);
  console.log(`Respaldo: ${backup}`);
  if (archived)
    console.log(
      "Se desactivó el acceso y se conservó el autor histórico de las evaluaciones.",
    );
  if (detached)
    console.log(
      `${detached} evento(s) conservado(s). Busca su nombre y edición para registrar nuevamente al organizador y recuperar el acceso.`,
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
