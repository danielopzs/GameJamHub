import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createLocalJams } from "./local-jams.mjs";

function fixture(withScores = false) {
  const dir = mkdtempSync(join(tmpdir(), "gj-delete-")),
    path = join(dir, "gamejam.sqlite");
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE state(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
  );
  createLocalJams(db);
  db.prepare("INSERT INTO local_organizers VALUES(?,?,?,?,?,?)").run(
    "u1",
    "Organizador",
    "danielopzs",
    "danielopzs@example.com",
    "test-hash",
    "password",
  );
  db.prepare(
    "INSERT INTO local_jams(id,name,name_key,owner_id,onboarded) VALUES(?,?,?,?,1)",
  ).run("jam1", "Mi jam", "mi jam", "u1");
  db.prepare("INSERT INTO local_jam_state(jam_id,key,value) VALUES(?,?,?)").run(
    "jam1",
    "gj-tasks",
    JSON.stringify([{ id: 1, title: "Conservar tarea", status: "Completada" }]),
  );
  db.prepare("INSERT INTO local_sessions VALUES(?,?,?,?)").run(
    "session-hash",
    "u1",
    "jam1",
    Date.now() + 100000,
  );
  if (withScores) {
    db.prepare("INSERT INTO local_access VALUES(?,?,?)").run(
      "jam1",
      "u1",
      "judge",
    );
    db.prepare(
      "INSERT INTO local_scorecards(jam_id,user_id,team_code,scores) VALUES(?,?,?,?)",
    ).run("jam1", "u1", "T1", JSON.stringify(Array(21).fill(1)));
  }
  db.close();
  const run = (selector) =>
    spawnSync(process.execPath, ["scripts/delete-local-user.mjs", selector], {
      encoding: "utf8",
      env: { ...process.env, DATA_DIR: dir },
    });
  return {
    dir,
    path,
    run,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
test("delete frees credentials, invalidates sessions, retains events and makes a restorable backup", () => {
  const f = fixture();
  let db;
  try {
    const result = f.run("danielopzs");
    assert.equal(result.status, 0, result.stderr);
    db = new DatabaseSync(f.path);
    assert.equal(
      db.prepare("SELECT count(*) n FROM local_organizers").get().n,
      0,
    );
    assert.equal(
      db.prepare("SELECT count(*) n FROM local_sessions").get().n,
      0,
    );
    assert.equal(
      db.prepare("SELECT owner_id FROM local_jams").get().owner_id,
      null,
    );
    assert.equal(
      JSON.parse(db.prepare("SELECT value FROM local_jam_state").get().value)[0]
        .status,
      "Completada",
    );
    const backup = new DatabaseSync(
      join(f.dir, "backups", readdirSync(join(f.dir, "backups"))[0]),
      { readOnly: true },
    );
    assert.equal(
      backup.prepare("SELECT username FROM local_organizers").get().username,
      "danielopzs",
    );
    backup.close();
  } finally {
    db?.close();
    f.cleanup();
  }
});
test("an author with submitted scores is disabled without changing scores or historic identity", () => {
  const f = fixture(true);
  let db;
  try {
    const result = f.run("danielopzs@example.com");
    assert.equal(result.status, 0, result.stderr);
    db = new DatabaseSync(f.path);
    const user = db.prepare("SELECT * FROM local_organizers").get();
    assert.equal(user.id, "u1");
    assert.equal(user.name, "Organizador");
    assert.equal(user.credential_type, "deleted");
    assert.notEqual(user.email, "danielopzs@example.com");
    assert.notEqual(user.username, "danielopzs");
    assert.equal(
      db.prepare("SELECT count(*) n FROM local_scorecards").get().n,
      1,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM local_access").get().n, 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db?.close();
    f.cleanup();
  }
});
test("an unknown selector does not delete users or create backups", () => {
  const f = fixture();
  let db;
  try {
    assert.equal(f.run("unknown@example.com").status, 1);
    db = new DatabaseSync(f.path);
    assert.equal(
      db.prepare("SELECT count(*) n FROM local_organizers").get().n,
      1,
    );
    assert.equal(readdirSync(f.dir).includes("backups"), false);
  } finally {
    db?.close();
    f.cleanup();
  }
});
