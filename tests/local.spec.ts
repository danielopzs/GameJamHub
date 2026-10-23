import { test, expect, type Page } from "@playwright/test";
async function next(page: Page) {
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}
async function answer(page: Page, yes: boolean) {
  await page
    .getByRole("button", { name: yes ? "Sí" : "No", exact: true })
    .click();
  await next(page);
}
test("presencial: register, branching questionnaire, dashboard and returning organizer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¿En qué jam trabajaremos hoy?" }),
  ).toBeVisible();
  await page.getByLabel("Nombre del jam").fill("Jam presencial de prueba");
  await next(page);
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Usuario", { exact: true }).fill("ana");
  await page.getByLabel("Correo", { exact: true }).fill("ana@example.com");
  await page
    .getByLabel("Contraseña / PIN", { exact: true })
    .fill("prueba-segura");
  await page.getByRole("button", { name: "Registrarme y continuar" }).click();
  await expect(
    page.getByRole("heading", {
      name: "¿El evento será presencial o virtual?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Presencial Compartiremos/ }).click();
  await next(page);
  await expect(page.getByText("Pregunta 2 de 9")).toBeVisible();
  await page.getByLabel("Nombre y ubicación de la sede").fill("Campus norte");
  await next(page);
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page
    .getByLabel("¿Qué relación tienen con la universidad?")
    .selectOption("Anfitrión");
  await next(page);
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByLabel("¿Cuál es el evento marco?").fill("Festival Indie");
  await next(page);
  await page.getByLabel("Participantes esperados").fill("100");
  await expect(page.getByText(/Con más de 90 participantes/)).toBeVisible();
  await next(page);
  await expect(
    page.getByRole("heading", { name: /recibir a 100 participantes/ }),
  ).toBeVisible();
  await answer(page, true);
  await expect(
    page.getByRole("heading", { name: "Ya casi terminamos." }),
  ).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByLabel("¿Quién es tu socio clave?").fill("Estudio Pixel");
  await next(page);
  await answer(page, false);
  await expect(
    page.getByRole("heading", { name: "Una pregunta más…" }),
  ).toBeVisible();
  await next(page);
  await expect(page.getByText("Pregunta 9 de 9")).toBeVisible();
  await page.getByLabel("Personas en el equipo organizador").fill("10");
  await page.getByRole("button", { name: "Preparar mi jam" }).click();
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
  await expect(page.locator(".jam-facts")).toContainText("Campus norte");
  await expect(page.locator(".jam-facts")).toContainText("Festival Indie");
  await expect(page.locator(".jam-facts")).toContainText("Estudio Pixel");
  await expect(page.locator(".jam-upcoming-list button")).toHaveCount(5);
  await expect(page.locator("body")).not.toContainText("Invalid Date");
  await page
    .getByRole("button", { name: "Agregar fechas", exact: true })
    .click();
  await page.getByLabel("Inicio", { exact: true }).fill("2027-05-01T10:00");
  await page.getByLabel("Fin", { exact: true }).fill("2027-05-03T10:00");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.locator(".jam-upcoming-list")).not.toContainText(
    "Por programar",
  );
  await page
    .getByRole("button", { name: "Ver tareas", exact: true })
    .first()
    .click();
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Completar tarea", exact: true })
    .first()
    .click();
  await expect(page.locator(".local-sync")).toContainText("pendientes");
  await page.context().setOffline(false);
  await expect
    .poll(async () => {
      const res = await page.request.post("/api/local/lookup", {
        data: { name: "Jam presencial de prueba" },
      });
      const { id } = await res.json();
      const state = await (
        await page.request.get(`/api/local/jams/${id}`)
      ).json();
      return state.state
        .find((r: { key: string }) => r.key === "gj-tasks")
        .value.filter((t: { status: string }) => t.status === "Completada")
        .length;
    })
    .toBe(1);
  await page.getByRole("button", { name: "Salir del jam" }).click();
  await page.getByLabel("Nombre del jam").fill(" JAM  PRESENCIAL de prueba ");
  await next(page);
  await page.getByLabel("Usuario o correo").fill("ana@example.com");
  await page.getByLabel("Contraseña o PIN").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar al jam" }).click();
  await expect(page.getByRole("alert")).toContainText("no corresponden");
  await page.getByLabel("Contraseña o PIN").fill("prueba-segura");
  await page.getByRole("button", { name: "Entrar al jam" }).click();
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/gamejam-dashboard.png", fullPage: true });
});

test("virtual: independent jam, PIN login and mobile layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Nombre del jam").fill("Jam virtual de prueba");
  await next(page);
  await page.getByLabel("Nombre completo").fill("Luis Torres");
  await page.getByLabel("Usuario", { exact: true }).fill("luis");
  await page.getByLabel("Correo", { exact: true }).fill("luis@example.com");
  await page.getByLabel("Tipo de acceso").selectOption("pin");
  await page.getByLabel("Contraseña / PIN", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Registrarme y continuar" }).click();
  await page.getByRole("button", { name: /Virtual Conectaremos/ }).click();
  await next(page);
  await expect(page.getByText("Pregunta 2 de 8")).toBeVisible();
  await answer(page, false);
  await page.getByLabel("Nombre de la plataforma").fill("Discord");
  await next(page);
  await page.getByLabel("Participantes esperados").fill("60");
  await next(page);
  await expect(
    page.getByRole("heading", {
      name: "¿Ya tienes una infraestructura en Discord?",
    }),
  ).toBeVisible();
  await answer(page, false);
  await next(page);
  await answer(page, false);
  await answer(page, false);
  await next(page);
  await page.getByLabel("Personas en el equipo organizador").fill("6");
  await page.getByRole("button", { name: "Preparar mi jam" }).click();
  await expect(page.locator(".jam-facts")).toContainText("Discord");
  await expect(page.locator(".jam-facts")).toContainText("6 personas");
  await expect(page.locator(".jam-facts")).not.toContainText("Campus norte");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Salir del jam" }).click();
  await page.getByLabel("Nombre del jam").fill("Jam virtual de prueba");
  await next(page);
  await page.getByLabel("Usuario o correo").fill("luis");
  await page.getByLabel("Contraseña o PIN").fill("123456");
  await page.getByRole("button", { name: "Entrar al jam" }).click();
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
});
