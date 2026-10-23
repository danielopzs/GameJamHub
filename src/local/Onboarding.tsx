import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Gamepad2,
  MapPin,
  Monitor,
  Sparkles,
} from "lucide-react";
import {
  localApi,
  type JamAnswers,
  type LocalJam,
  type Organizer,
} from "./types";
type Field =
  | "mode"
  | "venue"
  | "university"
  | "framework"
  | "platform"
  | "participants"
  | "infrastructure"
  | "partner"
  | "civil"
  | "teamSize";
export function Onboarding({
  jam,
  user,
  onDone,
  onExit,
}: {
  jam: LocalJam;
  user: Organizer;
  onDone: () => Promise<void>;
  onExit: () => void;
}) {
  const draftKey = `gj-questionnaire:${user.id}:${jam.id}`;
  const [answers, setAnswers] = useState<JamAnswers>(() => {
    try {
      return {
        ...jam.answers,
        ...JSON.parse(localStorage.getItem(draftKey) || "{}"),
      };
    } catch {
      return jam.answers;
    }
  });
  const [revision, setRevision] = useState(jam.answersRevision);
  const [index, setIndex] = useState(0);
  const [interlude, setInterlude] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const steps: Field[] = [
    "mode",
    ...(answers.mode === "Virtual"
      ? (["framework", "platform", "participants", "infrastructure"] as Field[])
      : ([
          "venue",
          "university",
          "framework",
          "participants",
          "infrastructure",
        ] as Field[])),
    "partner",
    "civil",
    "teamSize",
  ];
  const field = steps[index];
  const questions: Record<Field, string> = {
    mode: "¿El evento será presencial o virtual?",
    venue: "¿Dónde harás el game jam?",
    university: "¿Es una universidad?",
    framework: "¿El game jam se desarrolla en el marco de otro evento?",
    platform: "¿En qué plataforma lo harás?",
    participants:
      answers.mode === "Virtual"
        ? "¿Cuántos participantes esperas?"
        : "¿Cuántos participantes esperas recibir?",
    infrastructure:
      answers.mode === "Virtual"
        ? `¿Ya tienes una infraestructura en ${answers.platform || "la plataforma"}?`
        : `¿El espacio tiene la infraestructura para recibir a ${answers.participants || "esa cantidad de"} participantes?`,
    partner: "¿Tienes algún socio clave?",
    civil: "¿Te apoya algún grupo o sociedad civil?",
    teamSize: "¿Qué tan grande es tu equipo?",
  };
  function update<K extends keyof JamAnswers>(key: K, value: JamAnswers[K]) {
    const next = { ...answers, [key]: value };
    if (key === "mode") {
      delete next.venue;
      delete next.platform;
      delete next.university;
      delete next.universityRelation;
      setIndex(0);
    }
    setAnswers(next);
    localStorage.setItem(draftKey, JSON.stringify(next));
    setError("");
  }
  function valid() {
    if (field === "mode") return !!answers.mode;
    if (["venue", "platform"].includes(field))
      return !!String(answers[field as "venue" | "platform"] || "").trim();
    if (["participants", "teamSize"].includes(field))
      return (
        Number.isInteger(answers[field as "participants" | "teamSize"]) &&
        Number(answers[field as "participants" | "teamSize"]) > 0
      );
    if (field === "university")
      return (
        typeof answers.university === "boolean" &&
        (!answers.university || !!answers.universityRelation)
      );
    if (field === "framework")
      return (
        typeof answers.framework === "boolean" &&
        (!answers.framework || !!answers.frameworkName?.trim())
      );
    if (field === "partner")
      return (
        typeof answers.partner === "boolean" &&
        (!answers.partner || !!answers.partnerName?.trim())
      );
    if (field === "civil")
      return (
        typeof answers.civil === "boolean" &&
        (!answers.civil || !!answers.civilName?.trim())
      );
    return typeof answers.infrastructure === "boolean";
  }
  async function next() {
    if (!valid()) {
      setError("Completa esta respuesta para continuar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const complete = index === steps.length - 1;
      const result = await localApi<{ jam: LocalJam }>(
        `jams/${jam.id}/onboarding`,
        {
          method: "PUT",
          body: JSON.stringify({ answers, revision, complete }),
        },
      );
      setRevision(result.jam.answersRevision);
      if (complete) {
        localStorage.removeItem(draftKey);
        await onDone();
        return;
      }
      if (field === "infrastructure") setInterlude("almost");
      else if (field === "civil") setInterlude("last");
      else setIndex(index + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const booleanField = field as
    "university" | "framework" | "infrastructure" | "partner" | "civil";
  const detail =
    field === "framework"
      ? "frameworkName"
      : field === "partner"
        ? "partnerName"
        : field === "civil"
          ? "civilName"
          : null;
  return (
    <div className="jam-entry">
      <section className="jam-onboarding">
        <header className="jam-entry-header">
          <span className="brand-icon">
            <Gamepad2 size={23} />
          </span>
          <span>{jam.name}</span>
          <button className="text-button" onClick={onExit} disabled={busy}>
            Salir
          </button>
        </header>
        <div className="jam-progress-label">
          <span>
            {answers.mode
              ? `Pregunta ${index + 1} de ${steps.length}`
              : "Pregunta 1 · Comencemos"}
          </span>
          <span>
            {answers.mode
              ? `${Math.round(((index + 1) / steps.length) * 100)}%`
              : ""}
          </span>
        </div>
        <div className="jam-progress-track">
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        {interlude ? (
          <div className="jam-interlude">
            <span className="jam-illustration">
              <Sparkles size={36} />
            </span>
            <h1>
              {interlude === "last"
                ? "Una pregunta más…"
                : "Ya casi terminamos."}
            </h1>
            <p>
              {interlude === "last"
                ? "El tamaño de tu equipo nos ayudará a preparar la organización."
                : "Nos quedan unas pocas preguntas para conocer a las personas que harán posible este jam."}
            </p>
            <button
              className="button primary"
              onClick={() => {
                setInterlude("");
                setIndex(index + 1);
              }}
            >
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form
            className="jam-question"
            onSubmit={(e) => {
              e.preventDefault();
              void next();
            }}
          >
            <span className="eyebrow">
              {index === 0
                ? "PRIMERO, EL LUGAR"
                : index < steps.length - 3
                  ? "DISEÑEMOS TU EXPERIENCIA"
                  : "LAS PERSONAS DETRÁS DEL JAM"}
            </span>
            <h1 id="jam-question-title">{questions[field]}</h1>
            {field === "mode" ? (
              <div className="jam-mode-options">
                {(["Presencial", "Virtual"] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={answers.mode === mode ? "selected" : ""}
                    aria-pressed={answers.mode === mode}
                    onClick={() => update("mode", mode)}
                  >
                    {mode === "Presencial" ? (
                      <MapPin size={26} />
                    ) : (
                      <Monitor size={26} />
                    )}
                    <strong>{mode}</strong>
                    <small>
                      {mode === "Presencial"
                        ? "Compartiremos un espacio"
                        : "Conectaremos desde cualquier lugar"}
                    </small>
                    {answers.mode === mode && <Check size={17} />}
                  </button>
                ))}
              </div>
            ) : ["venue", "platform"].includes(field) ? (
              <label className="jam-answer-label">
                {field === "venue"
                  ? "Nombre y ubicación de la sede"
                  : "Nombre de la plataforma"}
                <input
                  autoFocus
                  key={field}
                  maxLength={250}
                  required
                  value={String(answers[field as "venue" | "platform"] || "")}
                  onChange={(e) =>
                    update(field as "venue" | "platform", e.target.value)
                  }
                  placeholder={
                    field === "venue"
                      ? "Ej. Centro de Innovación, Monterrey"
                      : "Ej. Discord, itch.io, Gather"
                  }
                />
              </label>
            ) : ["participants", "teamSize"].includes(field) ? (
              <label className="jam-answer-label">
                {field === "participants"
                  ? "Participantes esperados"
                  : "Personas en el equipo organizador"}
                <input
                  key={field}
                  autoFocus
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  required
                  value={answers[field as "participants" | "teamSize"] ?? ""}
                  onChange={(e) =>
                    update(
                      field as "participants" | "teamSize",
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  placeholder="Escribe una cantidad"
                />
              </label>
            ) : (
              <div className="jam-yes-no">
                {[true, false].map((answer) => (
                  <button
                    key={String(answer)}
                    type="button"
                    aria-pressed={answers[booleanField] === answer}
                    className={
                      answers[booleanField] === answer ? "selected" : ""
                    }
                    onClick={() => update(booleanField, answer)}
                  >
                    {answer ? "Sí" : "No"}
                    {answers[booleanField] === answer && <Check size={17} />}
                  </button>
                ))}
              </div>
            )}
            {field === "university" && answers.university && (
              <label className="jam-answer-label">
                ¿Qué relación tienen con la universidad?
                <select
                  required
                  value={answers.universityRelation || ""}
                  onChange={(e) => update("universityRelation", e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  {["Patrocinio", "Anfitrión", "Acuerdo", "Espacio pagado"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
            )}
            {detail && answers[booleanField] === true && (
              <label className="jam-answer-label">
                {detail === "frameworkName"
                  ? "¿Cuál es el evento marco?"
                  : detail === "partnerName"
                    ? "¿Quién es tu socio clave?"
                    : "¿Qué grupo o sociedad civil te apoya?"}
                <input
                  maxLength={250}
                  required
                  value={answers[detail] || ""}
                  onChange={(e) => update(detail, e.target.value)}
                />
              </label>
            )}
            {field === "participants" &&
              answers.mode === "Presencial" &&
              Number(answers.participants) > 90 && (
                <p className="jam-advice">
                  Con más de 90 participantes, consulta con la sede si requiere
                  servicio médico o ambulancia.
                </p>
              )}
            {field === "teamSize" && (
              <p className="jam-question-hint">
                Cuenta a las personas que organizan el evento, no a los
                participantes. Podrás asignar sus roles después.
              </p>
            )}
            {error && (
              <p className="cloud-error" role="alert">
                {error}
              </p>
            )}
            <footer className="jam-question-actions">
              <button
                className="button secondary"
                type="button"
                disabled={index === 0 || busy}
                onClick={() => setIndex(index - 1)}
              >
                <ArrowLeft size={16} />
                Atrás
              </button>
              <button className="button primary" type="submit" disabled={busy}>
                {busy
                  ? "Guardando…"
                  : index === steps.length - 1
                    ? "Preparar mi jam"
                    : "Continuar"}
                <ArrowRight size={16} />
              </button>
            </footer>
            <small className="jam-question-saved">
              Tus respuestas se guardan al continuar. Puedes regresar y
              revisarlas.
            </small>
          </form>
        )}
      </section>
    </div>
  );
}
