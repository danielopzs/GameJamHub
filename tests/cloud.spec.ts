import { test, expect, type BrowserContext } from "@playwright/test";
const owner = "00000000-0000-0000-0000-000000000001";
const judgeId = "00000000-0000-0000-0000-000000000002";
const actor = (email: string) => ({
  id: email === "judge@example.test" ? judgeId : owner,
  email,
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {
    full_name:
      email === "judge@example.test" ? "Juez de prueba" : "Anfitrión de prueba",
  },
});
const jwt = (email: string) =>
  [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: actor(email).id,
        email,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "mock-signature",
  ].join(".");

test("cloud UI: separate events, organizer persistence, participants, own-judge scoring and conflict recovery", async ({
  browser,
}) => {
  const events = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      owner_id: owner,
      name: "Jam Uno",
      revision: 1,
      created_at: "2026-01-01",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      owner_id: owner,
      name: "Jam Dos",
      revision: 1,
      created_at: "2026-01-02",
    },
  ];
  const makeState = (name: string) =>
    Object.entries({
      "gj-event": {
        name,
        start: "2027-01-29T17:00",
        end: "2027-01-31T17:00",
        mode: "Presencial",
        venue: "Monterrey",
        framework: false,
        frameworkName: "",
        vip: false,
      },
      "gj-host": {
        name: "Anfitrión de prueba",
        email: "owner@example.test",
        organization: "Comunidad de prueba",
        venue: "Monterrey",
        sponsors: "",
      },
      "gj-hosts": [],
      "gj-tasks": [
        {
          id: 1,
          title: "Confirmar venue " + name,
          phase: 1,
          priority: 0,
          status: "Pendiente",
          owner: "Anfitrión de prueba",
          day: -30,
        },
      ],
      "gj-members": [
        {
          name: "Anfitrión de prueba",
          email: "owner@example.test",
          role: "Director General / Líder del Jam",
          color: "blue",
        },
      ],
      "gj-teams": [
        {
          code: "T01",
          name: "Equipo de prueba",
          game: "Juego demo",
          time: "16:00",
          votes: 0,
        },
      ],
      "gj-participants": [],
      "gj-weight": 85,
    }).map(([key, value]) => ({ key, value, revision: 1 }));
  const states: Record<
    string,
    ReturnType<typeof makeState>
  > = Object.fromEntries(events.map((e) => [e.id, makeState(e.name)]));
  const access = [
    {
      email: "owner@example.test",
      name: "Anfitrión de prueba",
      role: "organizer",
    },
    { email: "judge@example.test", name: "Juez de prueba", role: "judge" },
  ];
  const evaluations: {
    judge_email: string;
    team_code: string;
    scores: number[];
  }[] = [];
  let forceConflict = false;
  async function mock(context: BrowserContext) {
    await context.route(
      "https://gamejam-test.supabase.co/**",
      async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        let body: any = {};
        try {
          body = req.postDataJSON() || {};
        } catch {}
        let email = "owner@example.test";
        try {
          email = JSON.parse(
            Buffer.from(
              req.headers().authorization.split(" ")[1].split(".")[1],
              "base64url",
            ).toString(),
          ).email;
        } catch {}
        const response = (value: unknown, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(value),
          });
        if (url.pathname === "/auth/v1/token")
          return response({
            access_token: jwt(body.email),
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "mock-refresh-token",
            user: actor(body.email),
          });
        if (url.pathname === "/auth/v1/user") return response(actor(email));
        if (url.pathname === "/auth/v1/logout")
          return route.fulfill({ status: 204 });
        const id = url.searchParams.get("event_id")?.slice(3) || body.p_event;
        if (url.pathname.endsWith("/jam_events")) {
          if (url.searchParams.get("id"))
            return response(
              events.find((e) => e.id === url.searchParams.get("id")?.slice(3)),
            );
          return response(
            email === "judge@example.test" ? events.slice(0, 1) : events,
          );
        }
        if (url.pathname.endsWith("/jam_state"))
          return response(
            states[id].filter(
              (row) =>
                email !== "judge@example.test" ||
                ["gj-event", "gj-teams", "gj-weight"].includes(row.key),
            ),
          );
        if (url.pathname.endsWith("/jam_members"))
          return response(
            access.filter(
              (m) => email !== "judge@example.test" || m.email === email,
            ),
          );
        if (url.pathname.endsWith("/jam_evaluations"))
          return response(
            evaluations.filter(
              (e) => email !== "judge@example.test" || e.judge_email === email,
            ),
          );
        if (url.pathname.endsWith("/jam_ranking"))
          return response([
            {
              team_code: "T01",
              jury_average: evaluations.length
                ? evaluations[0].scores.reduce((a, b) => a + b, 0)
                : 0,
              judge_count: evaluations.length,
              total: evaluations.length
                ? evaluations[0].scores.reduce((a, b) => a + b, 0) * 0.85
                : 0,
            },
          ]);
        if (url.pathname.endsWith("/jam_save_state")) {
          if (forceConflict) {
            forceConflict = false;
            return response(
              {
                code: "40001",
                message: "CONFLICT: otra persona modificó esta colección",
              },
              409,
            );
          }
          const row = states[id].find((s) => s.key === body.p_key)!;
          expect(body.p_revision).toBe(row.revision);
          row.value = body.p_value;
          row.revision++;
          events.find((e) => e.id === id)!.revision++;
          return response(row.revision);
        }
        if (url.pathname.endsWith("/jam_save_evaluation")) {
          expect(email).toBe("judge@example.test");
          expect(body.p_team).toBe("T01");
          evaluations.splice(0, evaluations.length, {
            judge_email: email,
            team_code: body.p_team,
            scores: body.p_scores,
          });
          events[0].revision++;
          return response(null);
        }
        throw Error("Unmocked Supabase operation: " + url.pathname);
      },
    );
  }
  const adminContext = await browser.newContext({ serviceWorkers: "block" });
  await mock(adminContext);
  const admin = await adminContext.newPage();
  const errors: string[] = [];
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto("/");
  await admin.getByLabel("Correo electrónico").fill("owner@example.test");
  await admin
    .getByLabel("Contraseña", { exact: true })
    .fill("test-password-only");
  await admin.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await admin.getByRole("button", { name: "Jam Uno", exact: false }).click();
  await expect(
    admin.getByRole("heading", { name: "Jam Uno", exact: false, level: 2 }),
  ).toBeVisible();
  await admin
    .getByRole("button", { name: "Tareas", exact: false })
    .first()
    .click();
  await admin
    .getByRole("button", { name: "Completar tarea", exact: true })
    .click();
  await expect
    .poll(
      () =>
        states[events[0].id].find((r) => r.key === "gj-tasks")!.value[0].status,
    )
    .toBe("Completada");
  await admin
    .getByRole("button", { name: "Mis eventos", exact: false })
    .click();
  await admin.getByRole("button", { name: "Jam Dos", exact: false }).click();
  await admin
    .getByRole("button", { name: "Tareas", exact: false })
    .first()
    .click();
  await expect(
    admin.getByRole("cell", { name: "Confirmar venue Jam Dos", exact: false }),
  ).toBeVisible();
  await expect(
    admin.getByRole("cell", { name: "Confirmar venue Jam Uno", exact: false }),
  ).toHaveCount(0);
  await admin
    .getByRole("button", { name: "Participantes", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Participante", exact: true })
    .click();
  await admin
    .getByLabel("Nombre completo", { exact: true })
    .fill("Participante de prueba");
  await admin
    .getByRole("button", { name: "Registrar participante", exact: true })
    .click();
  await expect
    .poll(
      () =>
        states[events[1].id].find((r) => r.key === "gj-participants")!.value
          .length,
    )
    .toBe(1);
  await admin
    .getByRole("button", { name: "Tareas", exact: false })
    .first()
    .click();
  forceConflict = true;
  await admin
    .getByRole("button", { name: "Completar tarea", exact: true })
    .click();
  await expect(admin.getByRole("alert")).toContainText("CONFLICT");
  expect(
    await admin
      .getByRole("button", { name: "Descargar borrador", exact: false })
      .count(),
  ).toBe(1);
  admin.on("dialog", (dialog) => dialog.accept());
  await admin
    .getByRole("button", { name: "Descartar borrador y recargar", exact: true })
    .click();
  await expect(admin.getByRole("alert")).toHaveCount(0);
  const judgeContext = await browser.newContext({ serviceWorkers: "block" });
  await mock(judgeContext);
  const judge = await judgeContext.newPage();
  judge.on("pageerror", (e) => errors.push(e.message));
  await judge.goto("/");
  await judge.getByLabel("Correo electrónico").fill("judge@example.test");
  await judge
    .getByLabel("Contraseña", { exact: true })
    .fill("test-password-only");
  await judge.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await judge.getByRole("button", { name: "Jam Uno", exact: false }).click();
  await expect(
    judge.getByRole("button", { name: "Tareas", exact: false }),
  ).toHaveCount(0);
  await expect(judge.getByLabel("Juez", { exact: true })).toBeDisabled();
  await expect(judge.getByLabel("Juez", { exact: true })).toHaveValue(
    "judge@example.test",
  );
  await judge.getByLabel("Concepto", { exact: true }).fill("9");
  await judge
    .getByRole("button", { name: "Guardar evaluación", exact: true })
    .click();
  await expect.poll(() => evaluations.length).toBe(1);
  expect(evaluations[0].scores[0]).toBe(9);
  await judge.reload();
  await judge.getByRole("button", { name: "Jam Uno", exact: false }).click();
  await expect(judge.getByLabel("Concepto", { exact: true })).toHaveValue("9");
  expect(errors).toEqual([]);
  await adminContext.close();
  await judgeContext.close();
});
