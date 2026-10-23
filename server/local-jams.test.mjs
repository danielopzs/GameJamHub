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

test("recurring editions have distinct identities, hybrid dates and crew survive onboarding", async () => {
  const { db, request: r } = fixture();
  try {
    const first = await r("register", {
      ...credentials,
      jamName: "Global Game Jam",
      edition: "2027",
    });
    const second = await r("login", {
      jamName: "Global Game Jam",
      edition: "2028",
      identifier: credentials.username,
      password: credentials.password,
      create: true,
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.notEqual(first.jam.id, second.jam.id);
    assert.equal(
      (await r("lookup", { name: "GLOBAL game jam", edition: " 2027 " })).id,
      first.jam.id,
    );
    const answers = {
      ...physical,
      mode: "Híbrido",
      platform: "Discord",
      start: "2027-05-01T10:00:00Z",
      end: "2027-05-03T10:00:00Z",
      planningStart: "2027-04-20T10:00:00Z",
      student: true,
      studentName: "Sociedad de videojuegos",
      crew: [
        {
          name: "Luis Torres",
          email: "luis@example.com",
          role: "Director de Logística & Venue",
        },
      ],
    };
    const path = `jams/${first.jam.id}`;
    assert.equal(
      (
        await r(
          path + "/onboarding",
          { answers, revision: 0, complete: true },
          first.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    const state = await r(path, null, first.cookie);
    assert.equal(state.jam.answers.studentName, answers.studentName);
    assert.equal(
      state.state.find((v) => v.key === "gj-members").value.length,
      2,
    );
    assert.equal(
      state.state.find((v) => v.key === "gj-event").value.platform,
      "Discord",
    );
    assert.equal(
      (
        await r(
          path + "/onboarding",
          {
            answers: { ...answers, end: answers.start },
            revision: 1,
            complete: true,
          },
          first.cookie,
          "PUT",
        )
      ).status,
      400,
    );
    const event = state.state.find((v) => v.key === "gj-event");
    assert.equal(
      (
        await r(
          path + "/state/gj-event",
          {
            value: { ...event.value, edition: "2028" },
            revision: event.revision,
          },
          first.cookie,
          "PUT",
        )
      ).status,
      409,
    );
  } finally {
    db.close();
  }
});

test("judges have private scorecards, independent revisions and no organizer permissions", async () => {
  const { db, request: r } = fixture();
  try {
    const { jam, cookie } = await r("register", credentials),
      path = `jams/${jam.id}`;
    await r(
      path + "/onboarding",
      { answers: virtual, revision: 0, complete: true },
      cookie,
      "PUT",
    );
    await r(
      path + "/state/gj-teams",
      {
        value: [{ code: "T1", name: "Equipo", game: "Juego", votes: 0 }],
        revision: 1,
      },
      cookie,
      "PUT",
    );
    const judge = {
      name: "Juez Uno",
      email: "juez1@example.com",
      username: "judge1",
      password: "judge-pass",
      role: "judge",
    };
    assert.equal((await r(path + "/access", judge, cookie)).status, 201);
    assert.equal(
      (
        await r(
          path + "/access",
          {
            ...judge,
            name: "Juez Dos",
            email: "juez2@example.com",
            username: "judge2",
          },
          cookie,
        )
      ).status,
      201,
    );
    const login = await r("login", {
      jamName: credentials.jamName,
      identifier: "judge1",
      password: "judge-pass",
    });
    assert.equal(login.user.role, "judge");
    const second = await r("login", {
      jamName: credentials.jamName,
      identifier: "judge2",
      password: "judge-pass",
    });
    assert.equal((await r(path, null, login.cookie)).status, 403);
    assert.equal(
      (
        await r(
          path + "/state/gj-teams",
          { value: [], revision: 2 },
          login.cookie,
          "PUT",
        )
      ).status,
      403,
    );
    const scores = Array(21).fill(1);
    assert.equal(
      (
        await r(
          path + "/scorecards/T1",
          { scores, revision: 0 },
          login.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          path + "/scorecards/T1",
          { scores: scores.map(() => 2), revision: 0 },
          second.cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await r(
          path + "/scorecards/T1",
          { scores, revision: 0 },
          login.cookie,
          "PUT",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await r(
          path + "/scorecards/T1",
          { scores: [999], revision: 1 },
          login.cookie,
          "PUT",
        )
      ).status,
      400,
    );
    const own = await r(path + "/portal", null, login.cookie);
    assert.equal(own.scorecards.length, 1);
    assert.equal(own.scorecards[0].scores[0], 1);
    assert.equal(
      own.reminders.every((n) => ["Todos", "Jueces"].includes(n.audience)),
      true,
    );
    const state = await r(path, null, cookie);
    assert.equal(
      Object.keys(state.state.find((v) => v.key === "gj-evaluations").value)
        .length,
      2,
    );
    await r(path + "/access/" + login.user.id, null, cookie, "DELETE");
    assert.equal((await r(path + "/portal", null, login.cookie)).status, 401);
  } finally {
    db.close();
  }
});

test("public enrollment enforces capacity, isolates tickets and allows organizer check-in only", async () => {
  const { db, request: r } = fixture();
  try {
    const { jam, cookie } = await r("register", credentials),
      path = `jams/${jam.id}`;
    await r(
      path + "/onboarding",
      { answers: {...virtual,start:"2027-05-01T10:00:00Z",end:"2027-05-03T10:00:00Z",planningStart:"2027-04-20T10:00:00Z"}, revision: 0, complete: true },
      cookie,
      "PUT",
    );
    assert.equal((await r(`public/${jam.id}`)).status, 403);
    const state = await r(path, null, cookie),
      event = state.state.find((v) => v.key === "gj-event");
    await r(
      path + "/state/gj-event",
      {
        value: { ...event.value, registrationOpen: true },
        revision: event.revision,
      },
      cookie,
      "PUT",
    );
    await r(
      path + "/state/gj-registration-capacity",
      { value: 1, revision: 1 },
      cookie,
      "PUT",
    );
    const results = await Promise.all([
      r(`public/${jam.id}`, { name: "Persona A", email: "a@example.com" }),
      r(`public/${jam.id}`, { name: "Persona B", email: "b@example.com" }),
    ]);
    assert.deepEqual(results.map((v) => v.status).sort(), [201, 409]);
    const registered = results.find((v) => v.status === 201);
    assert.equal((await r("ticket", { token: "incorrecto" })).status, 404);
    const receipt = await r("ticket", { token: registered.token });
    assert.equal(receipt.person.checkedIn, false);
    assert.equal(
      receipt.reminders.every((n) =>
        ["Todos", "Participantes"].includes(n.audience),
      ),
      true,
    );
    assert.equal((await r(path, null, receipt.cookie)).status, 401);
    const latest = await r(path, null, cookie),
      people = latest.state.find((v) => v.key === "gj-participants");
    assert.equal(
      (
        await r(
          path + "/state/gj-participants",
          {
            value: people.value.map((p) => ({ ...p, checkedIn: true })),
            revision: people.revision,
          },
          cookie,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (await r("ticket", { token: registered.token })).person.checkedIn,
      true,
    );
    const recovered = await r(
      path + "/tickets/" + people.value[0].id,
      {},
      cookie,
    );
    assert.equal(recovered.status, 200);
    assert.equal((await r("ticket", { token: registered.token })).status, 404);
    assert.equal(
      (await r("ticket", { token: recovered.token })).person.checkedIn,
      true,
    );
  } finally {
    db.close();
  }
});

test("committee access can distribute tasks without changing event settings or evaluations", async () => {
  const { db, request: r } = fixture();
  try {
    const { jam, cookie } = await r("register", credentials),
      path = `jams/${jam.id}`;
    await r(
      path + "/onboarding",
      {
        answers: {
          ...virtual,
          crew: [
            {
              name: "Staff Uno",
              email: "staff@example.com",
              role: "Director de Logística & Venue",
            },
          ],
        },
        revision: 0,
        complete: true,
      },
      cookie,
      "PUT",
    );
    assert.equal(
      (
        await r(
          path + "/access",
          {
            name: "Staff Uno",
            email: "staff@example.com",
            username: "staff",
            password: "staff-pass",
            role: "staff",
          },
          cookie,
        )
      ).status,
      201,
    );
    const login = await r("login", {
      jamName: credentials.jamName,
      identifier: "staff",
      password: "staff-pass",
    });
    assert.equal(login.user.role, "staff");
    const portal = await r(path + "/portal", null, login.cookie),
      task = portal.tasks[0];
    assert.equal(portal.tasks.length, 31);
    assert.equal(portal.members[0].email, undefined);
    const data = {
      status: "En progreso",
      owner: "Staff Uno",
      expected: { status: task.status, owner: task.owner },
    };
    assert.equal(
      (await r(path + "/tasks/" + task.id, data, login.cookie, "PUT")).status,
      200,
    );
    assert.equal(
      (await r(path + "/tasks/" + task.id, data, login.cookie, "PUT")).status,
      409,
    );
    assert.equal(
      (
        await r(
          path + "/state/gj-weight",
          { value: 0, revision: 1 },
          login.cookie,
          "PUT",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await r(
          path + "/scorecards/T1",
          { scores: [], revision: 0 },
          login.cookie,
          "PUT",
        )
      ).status,
      403,
    );
  } finally {
    db.close();
  }
});
