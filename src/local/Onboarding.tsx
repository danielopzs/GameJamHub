import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Gamepad2,
  MapPin,
  Monitor,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";
import { roles } from "../data";
import {
  localApi,
  type JamAnswers,
  type LocalJam,
  type Organizer,
} from "./types";
import { inputDate } from "./dates";
type Field =
  | "mode"
  | "dates"
  | "venue"
  | "university"
  | "framework"
  | "platform"
  | "participants"
  | "infrastructure"
  | "partner"
  | "civil"
  | "student"
  | "teamSize";
export function Onboarding({
  jam,
  user,
  onDone,
  onExit,
  editing = false,
}: {
  jam: LocalJam;
  user: Organizer;
  onDone: () => Promise<void>;
  onExit: () => void;
  editing?: boolean;
}) {
  const draftKey = `gj-questionnaire:${user.id}:${jam.id}`;
  const [answers, setAnswers] = useState<JamAnswers>(() => {
    let saved = { ...jam.answers };
    try {
      saved = {
        ...saved,
        ...JSON.parse(localStorage.getItem(draftKey) || "{}"),
      };
    } catch {}
    return {
      ...saved,
      start: inputDate(saved.start || ""),
      end: inputDate(saved.end || ""),
      planningStart: inputDate(
        saved.planningStart || jam.createdAt || new Date().toISOString(),
      ),
    };
  });
  const [revision, setRevision] = useState(jam.answersRevision),
    [index, setIndex] = useState(0),
    [interlude, setInterlude] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [knownTeam, setKnownTeam] = useState(!!answers.crew?.length);
  const physical = answers.mode !== "Virtual",
    remote = answers.mode !== "Presencial";
  const steps: Field[] = [
    "mode",
    "dates",
    ...(physical ? (["venue", "university"] as Field[]) : []),
    "framework",
    ...(remote ? (["platform"] as Field[]) : []),
    "participants",
    "infrastructure",
    "partner",
    "civil",
    "student",
    "teamSize",
  ];
  const field = steps[index];
  const questions: Record<Field, string> = {
    mode: "¿El evento será presencial, virtual o híbrido?",
    dates: "¿Cuándo será el jam y cuándo empieza la planeación?",
    venue: "¿Dónde harás el game jam?",
    university: "¿Es una universidad?",
    framework: "¿El game jam se desarrolla en el marco de otro evento?",
    platform: "¿En qué plataforma lo harás?",
    participants: "¿Cuántos participantes esperas recibir?",
    infrastructure:
      answers.mode === "Virtual"
        ? `¿Ya tienes una infraestructura en ${answers.platform || "la plataforma"}?`
        : answers.mode === "Híbrido"
          ? `¿La sede y ${answers.platform || "la plataforma"} están listas para ${answers.participants || "tus"} participantes?`
          : `¿El espacio tiene la infraestructura para recibir a ${answers.participants || "esa cantidad de"} participantes?`,
    partner: "¿Tienes algún socio clave?",
    civil: "¿Te apoya algún grupo o sociedad civil?",
    student: "¿Te apoya algún grupo o asociación estudiantil?",
    teamSize: "¿Qué tan grande es tu equipo?",
  };
  function update<K extends keyof JamAnswers>(key: K, value: JamAnswers[K]) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    localStorage.setItem(draftKey, JSON.stringify(next));
    setError("");
  }
  function valid() {
    if (field === "mode") return !!answers.mode;
    if (field === "dates")
      return (
        Number.isFinite(Date.parse(answers.start || "")) &&
        Date.parse(answers.end || "") > Date.parse(answers.start || "") &&
        Date.parse(answers.planningStart || "") <=
          Date.parse(answers.start || "")
      );
    if (field === "venue" || field === "platform")
      return !!answers[field]?.trim();
    if (field === "participants" || field === "teamSize")
      return (
        Number.isInteger(answers[field]) &&
        Number(answers[field]) > 0 &&
        (field !== "teamSize" ||
          !knownTeam ||
          (!!answers.crew?.length &&
            answers.crew.length < Number(answers.teamSize) &&
            answers.crew.every(
              (m) => m.name.trim() && m.email.trim() && m.role,
            )))
      );
    if (field === "university")
      return (
        typeof answers.university === "boolean" &&
        (!answers.university || !!answers.universityRelation)
      );
    if (field === "infrastructure")
      return typeof answers.infrastructure === "boolean";
    const detail = {
      framework: "frameworkName",
      partner: "partnerName",
      civil: "civilName",
      student: "studentName",
    }[field] as "frameworkName" | "partnerName" | "civilName" | "studentName";
    return (
      typeof answers[field] === "boolean" &&
      (!answers[field] || !!answers[detail]?.trim())
    );
  }
  async function next() {
    if (!valid()) {
      setError(
        field === "dates"
          ? "Revisa las tres fechas: la planeación comienza antes del inicio y el fin debe ser posterior."
          : field === "teamSize"
            ? "Completa los perfiles y cuenta también al organizador en el tamaño del equipo."
            : "Completa esta respuesta para continuar.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const complete = index === steps.length - 1;
      const payload = {
        ...answers,
        crew: knownTeam ? answers.crew : [],
        ...(answers.start && answers.end && answers.planningStart
          ? {
              start: new Date(answers.start).toISOString(),
              end: new Date(answers.end).toISOString(),
              planningStart: new Date(answers.planningStart).toISOString(),
            }
          : {}),
      };
      const result = await localApi<{ jam: LocalJam }>(
        `jams/${jam.id}/onboarding`,
        {
          method: "PUT",
          body: JSON.stringify({ answers: payload, revision, complete }),
        },
      );
      setRevision(result.jam.answersRevision);
      if (complete) {
        localStorage.removeItem(draftKey);
        await onDone();
        return;
      }
      if (field === "infrastructure") setInterlude("almost");
      else if (field === "student") setInterlude("last");
      else setIndex(index + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const booleanField = field as
    | "university"
    | "framework"
    | "infrastructure"
    | "partner"
    | "civil"
    | "student";
  const detail =
    field === "framework"
      ? "frameworkName"
      : field === "partner"
        ? "partnerName"
        : field === "civil"
          ? "civilName"
          : field === "student"
            ? "studentName"
            : null;
  return (
    <div className="jam-entry">
      <section className="jam-onboarding">
        <header className="jam-entry-header">
          <span className="brand-icon">
            <Gamepad2 size={23} />
          </span>
          <span>
            {jam.name} {jam.edition}
          </span>
          <button className="text-button" onClick={onExit} disabled={busy}>
            {editing ? "Volver al evento" : "Salir"}
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
                ? "Puedes agregar los perfiles de tu equipo y asignar tareas después."
                : "Nos quedan unas pocas preguntas sobre las personas que harán posible este jam."}
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
            <span className="eyebrow">CONFIGUREMOS ESTA EDICIÓN</span>
            <h1>{questions[field]}</h1>
            {field === "mode" ? (
              <div className="jam-mode-options">
                {(["Presencial", "Virtual", "Híbrido"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={answers.mode === mode}
                    className={answers.mode === mode ? "selected" : ""}
                    onClick={() => update("mode", mode)}
                  >
                    {mode === "Virtual" ? (
                      <Monitor size={24} />
                    ) : (
                      <MapPin size={24} />
                    )}
                    <strong>{mode}</strong>
                    <small>
                      {mode === "Presencial"
                        ? "Compartiremos un espacio"
                        : mode === "Virtual"
                          ? "Conectaremos desde cualquier lugar"
                          : "Sede y plataforma conectadas"}
                    </small>
                    {answers.mode === mode && <Check size={17} />}
                  </button>
                ))}
              </div>
            ) : field === "dates" ? (
              <div className="wizard-dates">
                {(
                  [
                    ["planningStart", "Inicio de planeación"],
                    ["start", "Inicio del jam"],
                    ["end", "Fin del jam"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="jam-answer-label" key={key}>
                    {label}
                    <input
                      type="datetime-local"
                      required
                      value={answers[key] || ""}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </label>
                ))}
                <p className="jam-question-hint">
                  Usamos la hora local de este navegador. El inicio de
                  planeación se propone a partir del registro en la plataforma;
                  ajústalo si ya habías empezado. El cronograma se adapta al
                  tiempo disponible.
                </p>
              </div>
            ) : field === "venue" || field === "platform" ? (
              <label className="jam-answer-label">
                {field === "venue"
                  ? "Nombre y ubicación de la sede"
                  : "Nombre de la plataforma"}
                <input
                  key={field}
                  autoFocus
                  maxLength={250}
                  required
                  value={answers[field] || ""}
                  onChange={(e) => update(field, e.target.value)}
                />
              </label>
            ) : field === "participants" || field === "teamSize" ? (
              <label className="jam-answer-label">
                {field === "participants"
                  ? "Participantes esperados"
                  : "Personas en el equipo organizador"}
                <input
                  key={field}
                  autoFocus
                  type="number"
                  min={1}
                  max={field === "teamSize" ? 10 : 100}
                  step={1}
                  required
                  value={answers[field] ?? ""}
                  onChange={(e) =>
                    update(
                      field,
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
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
                    : detail === "studentName"
                      ? "¿Qué grupo o asociación estudiantil te apoya?"
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
              physical &&
              Number(answers.participants) > 90 && (
                <p className="jam-advice">
                  Con más de 90 participantes, consulta con la sede si requiere
                  servicio médico o ambulancia.
                </p>
              )}
            {field === "teamSize" && (
              <div className="wizard-crew">
                <p className="jam-question-hint">
                  Inclúyete en el total. Estos perfiles se agregarán al comité;
                  después podrás asignarles tareas. No son cuentas de acceso.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={knownTeam}
                    onChange={(e) => setKnownTeam(e.target.checked)}
                  />
                  Ya tengo definido a mi equipo
                </label>
                {knownTeam && (
                  <>
                    <p>
                      El perfil de {user.name} ya está incluido como
                      organizador.
                    </p>
                    {(answers.crew || []).map((member, i) => (
                      <fieldset key={i}>
                        <legend>Integrante {i + 1}</legend>
                        <label>
                          Nombre del integrante
                          <input
                            required
                            value={member.name}
                            onChange={(e) =>
                              update(
                                "crew",
                                answers.crew!.map((m, j) =>
                                  j === i ? { ...m, name: e.target.value } : m,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Correo del integrante
                          <input
                            required
                            type="email"
                            value={member.email}
                            onChange={(e) =>
                              update(
                                "crew",
                                answers.crew!.map((m, j) =>
                                  j === i ? { ...m, email: e.target.value } : m,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Rol del integrante
                          <select
                            value={member.role}
                            onChange={(e) =>
                              update(
                                "crew",
                                answers.crew!.map((m, j) =>
                                  j === i ? { ...m, role: e.target.value } : m,
                                ),
                              )
                            }
                          >
                            {roles.map((role) => (
                              <option key={role}>{role}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="text-button"
                          aria-label={`Quitar integrante ${i + 1}`}
                          onClick={() =>
                            update(
                              "crew",
                              answers.crew!.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <Trash2 size={14} />
                          Quitar
                        </button>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        (answers.crew?.length || 0) >=
                        Math.min(
                          9,
                          Math.max(0, Number(answers.teamSize || 1) - 1),
                        )
                      }
                      onClick={() =>
                        update("crew", [
                          ...(answers.crew || []),
                          {
                            name: "",
                            email: "",
                            role: roles[1],
                            color: "blue",
                          },
                        ])
                      }
                    >
                      <Plus size={15} />
                      Agregar integrante
                    </button>
                  </>
                )}
              </div>
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
