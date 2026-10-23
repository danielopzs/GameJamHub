import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createLocalJams } from "./local-jams.mjs";

function fixture(legacy) {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE state(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  for (const [key, value] of Object.entries(legacy || {}))
    db.prepare("INSERT INTO state VALUES(?,?)").run(key, JSON.stringify(value));
  const api = createLocalJams(db);
  async function request(
    path,
    data,
    cookie = "",
    method = data ? "POST" : "GET",
  ) {
    let status, result;
    const headers = {};
    await api.handle(
      { method, headers: { cookie }, socket: { remoteAddress: "127.0.0.1" } },
      { setHeader: (k, v) => (headers[k] = v) },
      "/api/local/" + path,
      async () => data,
      (_, s, v) => {
        status = s;
        result = v;
      },
    );
    return { status, ...result, cookie: headers["Set-Cookie"]?.split(";")[0] };
  }
  return { db, request };
}
const credentials = {
  jamName: "Mi Jam",
  name: "Ana Pérez",
  username: "ana",
  email: "ana@example.com",
  password: "prueba-1234",
};
const physical = {
  mode: "Presencial",
  venue: "Campus norte",
  university: true,
  universityRelation: "Anfitrión",
  framework: true,
  frameworkName: "Festival",
  participants: 100,
  infrastructure: false,
  partner: true,
  partnerName: "Estudio",
  civil: false,
  teamSize: 10,
};
const virtual = {
  mode: "Virtual",
  platform: "Discord",
  framework: false,
  participants: 40,
  infrastructure: true,
  partner: false,
  civil: false,
  teamSize: 5,
};

test("organizers, normalized jam lookup, isolated events, PINs and logout", async () => {
  const { db, request: r } = fixture();
  try {
    const first = await r("register", credentials);
    assert.equal(first.status, 201);
    assert.equal(first.user.email, credentials.email);
    assert.equal(first.user.password_hash, undefined);
    assert.notEqual(
      db.prepare("SELECT password_hash FROM local_organizers").get()
        .password_hash,
      credentials.password,
    );
    assert.match(
      db.prepare("SELECT password_hash FROM local_organizers").get()
        .password_hash,
      /^scrypt:/,
    );
    const lookup = await r("lookup", { name: "  MI   JAM  " });
    assert.equal(lookup.id, first.jam.id);
    assert.equal(lookup.user, undefined);
    assert.equal(
      (
        await r("register", {
          ...credentials,
          username: "other",
          email: "other@example.com",
          jamName: "mi jam",
        })
      ).status,
      409,
    );
    assert.equal((await r(`jams/${first.jam.id}`)).status, 401);
    assert.equal(
      (
        await r("login", {
          jamName: "Mi Jam",
          identifier: "ana",
          password: "incorrecta",
        })
      ).status,
      401,
    );
    const login = await r("login", {
      jamName: "mi jam",
      identifier: "ANA@EXAMPLE.COM",
      password: credentials.password,
    });
    assert.equal(login.status, 200);
    const second = await r("register", {
      ...credentials,
      jamName: "Otra Jam",
      username: "otro",
      email: "otro@example.com",
      password: "123456",
      credentialType: "pin",
    });
    assert.equal(second.status, 201);
    assert.equal(
      (await r(`jams/${first.jam.id}`, null, second.cookie)).status,
      403,
    );
    assert.equal(
      (
        await r(
          `jams/${first.jam.id}/onboarding`,
          { answers: physical, revision: 0, complete: true },
          first.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          `jams/${second.jam.id}/onboarding`,
          { answers: virtual, revision: 0, complete: true },
          second.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    const data = await r(`jams/${first.jam.id}`, null, first.cookie);
    assert.equal(data.state.find((x) => x.key === "gj-tasks").value.length, 31);
    assert.equal(
      data.state
        .find((x) => x.key === "gj-tasks")
        .value.every((t) => t.status === "Pendiente"),
      true,
    );
    assert.deepEqual(data.state.find((x) => x.key === "gj-teams").value, []);
    assert.equal(data.jam.answers.venue, "Campus norte");
    const other = await r(`jams/${second.jam.id}`, null, second.cookie);
    assert.equal(other.jam.answers.venue, undefined);
    assert.equal(other.jam.answers.platform, "Discord");
    assert.equal((await r("logout", {}, login.cookie)).status, 200);
    assert.equal(
      (await r(`jams/${first.jam.id}`, null, login.cookie)).status,
      401,
    );
    for (let n = 2; n <= 6; n++)
      assert.equal(
        (
          await r("login", {
            jamName: `Edición ${n}`,
            identifier: "ana",
            password: credentials.password,
            create: true,
          })
        ).status,
        200,
      );
    assert.equal(
      (
        await r("login", {
          jamName: "Edición 7",
          identifier: "ana",
          password: credentials.password,
          create: true,
        })
      ).status,
      400,
    );
  } finally {
    db.close();
  }
});

test("questionnaire validation, revisions and existing data are preserved on editing", async () => {
  const { db, request: r } = fixture();
  try {
    const { jam, cookie } = await r("register", credentials);
    const path = `jams/${jam.id}`;
    assert.equal(
      (
        await r(
          path + "/onboarding",
          { answers: physical, revision: 0 },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          path + "/onboarding",
          { answers: physical, revision: 0 },
          cookie,
          "PUT",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await r(
          path + "/onboarding",
          {
            answers: { ...physical, universityRelation: "" },
            revision: 1,
            complete: true,
          },
          cookie,
          "PUT",
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await r(
          path + "/onboarding",
          { answers: physical, revision: 1, complete: true },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          path + "/state/gj-teams",
          { value: [{ code: "A", name: "Equipo conservado" }], revision: 1 },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          path + "/state/gj-teams",
          { value: [], revision: 1 },
          cookie,
          "PUT",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await r(
          path + "/onboarding",
          { answers: virtual, revision: 2, complete: true },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    const result = await r(path, null, cookie);
    assert.equal(
      result.state.find((x) => x.key === "gj-teams").value[0].name,
      "Equipo conservado",
    );
    assert.equal(
      result.state.find((x) => x.key === "gj-event").value.mode,
      "Virtual",
    );
    assert.equal(result.jam.answers.venue, undefined);
    assert.equal(
      (
        await r(
          path + "/state/gj-participants",
          { value: Array(101).fill({ name: "Persona" }), revision: 1 },
          cookie,
          "PUT",
        )
      ).status,
      400,
    );
  } finally {
    db.close();
  }
});

test("legacy SQLite data is copied once and retained when the first organizer claims the jam", async () => {
  const previous = {
    "gj-event": {
      name: "Jam anterior",
      start: "2027-05-01T10:00",
      end: "2027-05-03T10:00",
    },
    "gj-teams": [{ code: "T1", name: "Anterior" }],
    "gj-tasks": [{ id: 99, title: "Ya realizada", status: "Completada" }],
  };
  const { db, request: r } = fixture(previous);
  try {
    assert.equal(
      (await r("lookup", { name: "Jam anterior" })).needsOwner,
      true,
    );
    const { jam, cookie } = await r("register", {
      ...credentials,
      jamName: "Jam anterior",
    });
    assert.equal(
      (
        await r(
          `jams/${jam.id}/onboarding`,
          { answers: physical, revision: 0, complete: true },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    const result = await r(`jams/${jam.id}`, null, cookie);
    assert.equal(
      result.state.find((x) => x.key === "gj-event").value.start,
      previous["gj-event"].start,
    );
    assert.deepEqual(
      result.state.find((x) => x.key === "gj-tasks").value,
      previous["gj-tasks"],
    );
    assert.deepEqual(
      JSON.parse(
        db.prepare("SELECT value FROM state WHERE key='gj-teams'").get().value,
      ),
      previous["gj-teams"],
    );
    createLocalJams(db);
    assert.equal(db.prepare("SELECT count(*) n FROM local_jams").get().n, 1);
  } finally {
    db.close();
  }
});

test("failed login attempts are limited", async () => {
  const { db, request: r } = fixture();
  try {
    await r("register", credentials);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await r("login", {
            jamName: "Mi Jam",
            identifier: "ana",
            password: "wrong",
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await r("login", {
          jamName: "Mi Jam",
          identifier: "ana",
          password: credentials.password,
        })
      ).status,
      429,
    );
  } finally {
    db.close();
  }
});
