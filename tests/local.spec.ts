import { test, expect, type Page } from "@playwright/test";
async function next(p: Page) {
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
}
async function yesNo(p: Page, value: boolean) {
  await p
    .getByRole("button", { name: value ? "Sí" : "No", exact: true })
    .click();
  await next(p);
}
async function lookup(p: Page, name: string, edition: string) {
  await p.goto("/");
  await p.getByLabel("Nombre del jam", { exact: true }).fill(name);
  await p.getByLabel("Edición del jam").fill(edition);
  await next(p);
}
async function login(
  p: Page,
  name: string,
  edition: string,
  user: string,
  password: string,
) {
  await lookup(p, name, edition);
  await p.getByLabel("Usuario o correo").fill(user);
  await p.getByLabel("Contraseña o PIN").fill(password);
  await p.getByRole("button", { name: "Entrar al jam" }).click();
}
async function waitSaved(p: Page) {
  await expect(p.locator(".local-sync")).toContainText("Guardado");
}
async function register(
  p: Page,
  name: string,
  edition: string,
  user: string,
  mode: "Presencial" | "Virtual" | "Híbrido",
  crew = false,
) {
  await lookup(p, name, edition);
  await p.getByLabel("Nombre completo").fill("Organizador " + user);
  await p.getByLabel("Usuario", { exact: true }).fill(user);
  await p.getByLabel("Correo", { exact: true }).fill(user + "@example.com");
  await p.getByLabel("Contraseña / PIN", { exact: true }).fill("prueba-segura");
  await p.getByRole("button", { name: "Registrarme y continuar" }).click();
  await p.getByRole("button", { name: new RegExp("^" + mode + " ") }).click();
  await next(p);
  await expect(
    p.getByRole("heading", {
      name: "¿Cuándo será el jam y cuándo empieza la planeación?",
    }),
  ).toBeVisible();
  await p
    .getByLabel("Inicio de planeación", { exact: true })
    .fill("2027-04-20T10:00");
  await p
    .getByLabel("Inicio del jam", { exact: true })
    .fill("2027-05-01T10:00");
  await p.getByLabel("Fin del jam", { exact: true }).fill("2027-05-03T10:00");
  await next(p);
  if (mode !== "Virtual") {
    await p.getByLabel("Nombre y ubicación de la sede").fill("Campus norte");
    await next(p);
    await p.getByRole("button", { name: "Sí", exact: true }).click();
    await p
      .getByLabel("¿Qué relación tienen con la universidad?")
      .selectOption("Anfitrión");
    await next(p);
  }
  await p.getByRole("button", { name: "Sí", exact: true }).click();
  await p.getByLabel("¿Cuál es el evento marco?").fill("Festival Indie");
  await next(p);
  if (mode !== "Presencial") {
    await p.getByLabel("Nombre de la plataforma").fill("Discord");
    await next(p);
  }
  await p.getByLabel("Participantes esperados").fill("100");
  if (mode !== "Virtual")
    await expect(p.getByText(/Con más de 90 participantes/)).toBeVisible();
  await next(p);
  await yesNo(p, true);
  await expect(
    p.getByRole("heading", { name: "Ya casi terminamos." }),
  ).toBeVisible();
  await next(p);
  await yesNo(p, false);
  await yesNo(p, false);
  await p.getByRole("button", { name: "Sí", exact: true }).click();
  await p
    .getByLabel("¿Qué grupo o asociación estudiantil te apoya?")
    .fill("Sociedad de videojuegos");
  await next(p);
  await expect(
    p.getByRole("heading", { name: "Una pregunta más…" }),
  ).toBeVisible();
  await next(p);
  await p.getByLabel("Personas en el equipo organizador").fill("10");
  if (crew) {
    await p.getByLabel("Ya tengo definido a mi equipo").check();
    await p.getByRole("button", { name: "Agregar integrante" }).click();
    await p.getByLabel("Nombre del integrante").fill("Luis Torres");
    await p.getByLabel("Correo del integrante").fill("staff@example.com");
    await p
      .getByLabel("Rol del integrante")
      .selectOption("Director de Logística & Venue");
  }
  await p.getByRole("button", { name: "Preparar mi jam" }).click();
  await expect(
    p.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
  await waitSaved(p);
}
test("hybrid edition: onboarding dates, crew, review without reset, timeline, prizes and offline writes", async ({
  page,
}) => {
  await register(page, "Global Game Jam", "2027", "ana", "Híbrido", true);
  await expect(page.locator(".jam-facts")).toContainText(
    "Campus norte · Discord",
  );
  await expect(page.locator(".jam-facts")).toContainText(
    "Sociedad de videojuegos",
  );
  await expect(page.locator("body")).not.toContainText("Invalid Date");
  await page.getByRole("button", { name: "Respuestas del evento" }).click();
  await expect(
    page.getByRole("heading", { name: "Respuestas del evento" }),
  ).toBeVisible();
  await expect(page.locator(".event-review")).toContainText("2027");
  await page.getByRole("button", { name: "Volver al dashboard" }).click();
  await page.getByRole("button", { name: "Respuestas del evento" }).click();
  await page.getByRole("button", { name: "Editar configuración" }).click();
  await expect(page.getByRole("button", { name: /^Híbrido / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Volver al evento" }).click();
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver tareas", exact: true }).click();
  await page.getByRole("button", { name: "Cronograma", exact: true }).click();
  await expect(page.locator(".timeline-task")).toHaveCount(31);
  await expect(page.locator(".timeline-axis")).toContainText("abr");
  await page.getByRole("button", { name: "Tabla", exact: true }).click();
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Completar tarea", exact: true })
    .first()
    .click();
  await expect(page.locator(".local-sync")).toContainText("pendientes");
  await page.context().setOffline(false);
  await waitSaved(page);
  await page.getByRole("button", { name: "Premios", exact: true }).click();
  await page.getByLabel("Nombre del premio").fill("Licencias de desarrollo");
  await page.getByLabel("Patrocinador", { exact: true }).fill("Estudio Pixel");
  await page.getByLabel("Valor unitario (MXN)").fill("2500");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByLabel("Asignación").selectOption("1");
  await page.getByLabel("Estado").selectOption("Confirmado");
  await page.getByRole("button", { name: "Agregar premio" }).click();
  await expect(page.locator(".prize-totals")).toContainText("5,000");
  await waitSaved(page);
  await page
    .getByRole("button", { name: "Recordatorios", exact: true })
    .click();
  await expect(page.locator(".notice-critical").first()).toBeVisible();
  await page.getByLabel("Mensaje del aviso").fill("Reunión del jurado");
  await page.getByLabel("Fecha y hora del aviso").fill("2027-05-03T11:00");
  await page.getByLabel("Destinatarios").selectOption("Jueces");
  await page.getByLabel("Nivel").selectOption("critical");
  await page.getByRole("button", { name: "Programar aviso" }).click();
  await waitSaved(page);
  await page.getByRole("button", { name: "Salir del jam" }).click();
  await login(
    page,
    "GLOBAL game jam",
    "2027",
    "ana@example.com",
    "prueba-segura",
  );
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
});

test("automatic enrollment, ticket, check-in, sponsor metrics and independent judge and committee access", async ({
  page,
  browser,
}) => {
  await login(page, "Global Game Jam", "2027", "ana", "prueba-segura");
  await expect(
    page.getByRole("heading", { name: "Así será tu jam" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Evaluación y premios", exact: true })
    .click();
  await page.getByRole("button", { name: "Equipo", exact: true }).click();
  await page.getByLabel("Código", { exact: true }).fill("T1");
  await page
    .getByLabel("Nombre del equipo", { exact: true })
    .fill("Pixel Team");
  await page
    .getByLabel("Nombre del juego", { exact: true })
    .fill("Juego del futuro");
  await page.getByLabel("Hora de presentación", { exact: true }).fill("17:00");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await waitSaved(page);
  await page
    .getByRole("button", { name: "Resumen", exact: true })
    .first()
    .click();
  await page
    .getByText("Registrar o corregir entrega de un juego", { exact: true })
    .click();
  await page.getByLabel("Equipo de la entrega").selectOption("T1");
  await page.getByLabel("Enlace del juego").fill("https://example.com/juego");
  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  await waitSaved(page);
  await page
    .getByRole("button", { name: "Participantes", exact: true })
    .click();
  await page.getByLabel("Abrir inscripciones públicas").check();
  await waitSaved(page);
  const link = await page
    .getByLabel("Enlace de registro", { exact: true })
    .inputValue();
  const context = await browser.newContext({ serviceWorkers: "block" }),
    guest = await context.newPage();
  try {
    await guest.goto(link);
    await guest.getByLabel("Nombre completo").fill("Participante Uno");
    await guest
      .getByLabel("Correo de contacto")
      .fill("participante@example.com");
    await guest.getByLabel("Código de equipo (opcional)").fill("T1");
    await guest.getByLabel(/Acepto compartir/).check();
    await guest.getByRole("button", { name: "Confirmar inscripción" }).click();
    await expect(
      guest.getByRole("heading", { name: "¡Tu lugar está registrado!" }),
    ).toBeVisible();
    await expect(guest.locator(".ticket-code")).toContainText(
      "Check-in pendiente",
    );
    await expect(page.locator(".participants-panel")).toContainText(
      "Participante Uno",
      { timeout: 10000 },
    );
    await page
      .getByRole("row")
      .filter({ hasText: "Participante Uno" })
      .getByRole("checkbox")
      .check();
    await waitSaved(page);
    await guest.reload();
    await expect(guest.locator(".ticket-code")).toContainText(
      "Entrada confirmada",
    );
  } finally {
    await context.close();
  }
  await page
    .getByRole("button", { name: "Resumen", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".metric-grid article")
      .filter({ hasText: "Participantes registrados" }),
  ).toContainText("1");
  await expect(
    page
      .locator(".metric-grid article")
      .filter({ hasText: "Juegos entregados" }),
  ).toContainText("1");
  await page
    .getByRole("button", { name: "Accesos del jurado", exact: true })
    .click();
  await page.getByLabel("Nombre del acceso").fill("Juez Uno");
  await page.getByLabel("Usuario del acceso").fill("judge1");
  await page.getByLabel("Correo del acceso").fill("juez@example.com");
  await page
    .getByLabel("Contraseña inicial", { exact: true })
    .fill("judge-pass");
  await page.getByRole("button", { name: "Crear acceso", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Acceso creado");
  const judgeContext = await browser.newContext({ serviceWorkers: "block" }),
    judge = await judgeContext.newPage();
  try {
    await login(judge, "Global Game Jam", "2027", "judge1", "judge-pass");
    await expect(
      judge.getByRole("heading", { name: "Evaluación del jurado" }),
    ).toBeVisible();
    await judge.getByLabel("Equipo para evaluar").selectOption("T1");
    await expect(
      judge.getByRole("link", { name: "Abrir juego entregado" }),
    ).toHaveAttribute("href", "https://example.com/juego");
    await judge.getByLabel("Concepto", { exact: true }).fill("8");
    await judge.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(judge.getByRole("status")).toHaveText("Evaluación guardada");
    await expect(judge.locator(".guest-notices")).toContainText(
      "Reunión del jurado",
    );
    await expect(
      judge.getByRole("button", { name: "Editar evento" }),
    ).toHaveCount(0);
  } finally {
    await judgeContext.close();
  }
  await page.getByLabel("Nombre del acceso").fill("Luis Torres");
  await page.getByLabel("Usuario del acceso").fill("staff");
  await page.getByLabel("Correo del acceso").fill("staff@example.com");
  await page
    .getByLabel("Contraseña inicial", { exact: true })
    .fill("staff-pass");
  await page.getByLabel("Perfil de acceso").selectOption("staff");
  await page.getByRole("button", { name: "Crear acceso", exact: true }).click();
  await expect(page.locator(".access-row")).toHaveCount(2);
  const staffContext = await browser.newContext({ serviceWorkers: "block" }),
    staff = await staffContext.newPage();
  try {
    await login(staff, "Global Game Jam", "2027", "staff", "staff-pass");
    await expect(
      staff.getByRole("heading", { name: "Tareas del comité" }),
    ).toBeVisible();
    await staff
      .getByLabel("Responsable de Reservar y confirmar el venue", {
        exact: true,
      })
      .selectOption("Luis Torres");
    await expect(
      staff.getByLabel("Responsable de Reservar y confirmar el venue", {
        exact: true,
      }),
    ).toHaveValue("Luis Torres");
  } finally {
    await staffContext.close();
  }
  await page
    .getByRole("button", { name: "Evaluación y premios", exact: true })
    .click();
  await expect(page.locator(".leader-item")).toContainText("1 evaluaciones", {
    timeout: 10000,
  });
  await expect(page.locator(".leader-item")).toContainText(
    "Licencias de desarrollo",
  );
  await page
    .getByRole("button", { name: "Resumen", exact: true })
    .first()
    .click();
  await page.screenshot({
    path: "/tmp/gamejam-feedback-dashboard.png",
    fullPage: true,
  });
});

test("mobile virtual edition keeps separate data and requires the matching edition at login", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, "Game Jam móvil", "Primavera", "luis", "Virtual");
  await expect(page.locator(".jam-facts")).toContainText("Discord");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/gamejam-feedback-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salir del jam" }).click();
  await lookup(page, "Game Jam móvil", "Otra edición");
  await expect(
    page.getByRole("button", { name: "Registrarme y continuar" }),
  ).toBeVisible();
});
