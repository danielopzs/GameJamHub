import { eventSize } from "../../shared/event-profile.mjs";
import { createId } from "../id";
import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  Users,
  Trophy,
  BarChart3,
  Link as LinkIcon,
} from "lucide-react";
import { useLocal } from "../storage";
import { useLocalEvent } from "./store";
import { localApi } from "./types";
export type Prize = {
  id: string;
  name: string;
  sponsor: string;
  value: number;
  quantity: number;
  place: number;
  status: string;
};
type Person = {
  id: string;
  name: string;
  email: string;
  teamCode: string;
  checkedIn: boolean;
};
type Team = {
  code: string;
  name: string;
  game: string;
  time: string;
  votes: number;
  submission?: string;
  submitted?: boolean;
  submittedAt?: string;
};
const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );
export function EventMetrics() {
  const local = useLocalEvent()!,
    [people] = useLocal<Person[]>("gj-participants", []),
    [teams, setTeams] = useLocal<Team[]>("gj-teams", []),
    [tasks] = useLocal<{ status: string }[]>("gj-tasks", []),
    [prizes] = useLocal<Prize[]>("gj-prizes", []),
    [selected, setSelected] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const present = people.filter((p) => p.checkedIn).length,
    assigned = people.filter((p) =>
      teams.some((t) => t.code === p.teamCode),
    ).length,
    games = teams.filter((t) => t.submitted && t.submission).length,
    confirmed = prizes
      .filter((p) => p.status !== "Propuesto")
      .reduce((sum, p) => sum + p.value * p.quantity, 0);
  const facts = [
    ["Participantes registrados", people.length],
    ["Check-ins realizados", present],
    ["Equipos registrados", teams.length],
    ["Participantes con equipo", assigned],
    ["Juegos entregados", games],
    ["Premios confirmados (MXN)", money(confirmed)],
  ];
  return (
    <section className="panel event-metrics">
      <div className="section-heading">
        <div>
          <h3>
            <BarChart3 size={18} />
            Pulso del evento
          </h3>
          <p>
            {local.error
              ? "Sincronización pendiente"
              : `Datos del servidor · ${local.lastSync || "actualizando"}`}{" "}
            · se actualiza cada 5 segundos con conexión.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            const rows = [
              ["Evento", local.jam.name],
              ["Edición", local.jam.edition || ""],
              [
                "Tamaño previsto (sin organizadores)",
                eventSize(local.jam.answers.participants),
              ],
              [
                "Tamaño por inscritos (sin organizadores)",
                eventSize(people.length),
              ],
              ["Generado", new Date().toISOString()],
              ...facts,
              ["Participantes sin equipo", people.length - assigned],
              [
                "Tareas completadas",
                tasks.filter((t) => t.status === "Completada").length,
              ],
            ];
            const quote = (v: unknown) => {
              let text = String(v);
              if (/^[=+@-]/.test(text)) text = "'" + text;
              return '"' + text.replaceAll('"', '""') + '"';
            };
            const url = URL.createObjectURL(
              new Blob(
                [
                  "\uFEFF" +
                    rows.map((row) => row.map(quote).join(",")).join("\r\n"),
                ],
                { type: "text/csv;charset=utf-8" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "metricas-sponsors.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={14} />
          Exportar métricas
        </button>
      </div>
      <div className="metric-grid">
        {facts.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p>
        Tamaño por inscritos: {eventSize(people.length)} ({people.length}{" "}
        participantes, sin organizadores). {people.length - assigned}{" "}
        participantes sin equipo ·{" "}
        {Math.round((present / Math.max(1, people.length)) * 100)}% de
        asistencia · {Math.round((games / Math.max(1, teams.length)) * 100)}% de
        equipos con entrega. Las cifras describen los registros capturados; no
        estiman impacto externo.
      </p>
      <details>
        <summary>Registrar o corregir entrega de un juego</summary>
        <form
          className="operation-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^https?:\/\//i.test(url)) {
              setError("Usa un enlace HTTP o HTTPS.");
              return;
            }
            setTeams(
              teams.map((t) =>
                t.code === selected
                  ? {
                      ...t,
                      submission: url,
                      submitted: true,
                      submittedAt: new Date().toISOString(),
                    }
                  : t,
              ),
            );
            setError("");
            setUrl("");
            setSelected("");
          }}
        >
          <label>
            Equipo de la entrega
            <select
              required
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setUrl(
                  teams.find((t) => t.code === e.target.value)?.submission ||
                    "",
                );
              }}
            >
              <option value="">Selecciona un equipo</option>
              {teams.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Enlace del juego
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://itch.io/jam/..."
            />
          </label>
          <button className="button primary">Confirmar entrega</button>
          {selected && teams.find((t) => t.code === selected)?.submitted && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setTeams(
                  teams.map((t) =>
                    t.code === selected ? { ...t, submitted: false } : t,
                  ),
                )
              }
            >
              Marcar como pendiente
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </form>
      </details>
    </section>
  );
}
export function PrizeBudget() {
  const [prizes, setPrizes] = useLocal<Prize[]>("gj-prizes", []);
  const total = prizes.reduce((n, p) => n + p.value * p.quantity, 0),
    confirmed = prizes
      .filter((p) => p.status !== "Propuesto")
      .reduce((n, p) => n + p.value * p.quantity, 0);
  return (
    <section className="panel operation-panel">
      <div className="section-heading">
        <div>
          <h3>
            <Trophy size={18} />
            Premios y aportaciones
          </h3>
          <p>
            Valor declarado en MXN, incluyendo premios en especie. No representa
            dinero recibido.
          </p>
        </div>
      </div>
      <div className="prize-totals">
        <span>
          Valor previsto<strong>{money(total)}</strong>
        </span>
        <span>
          Confirmado o entregado<strong>{money(confirmed)}</strong>
        </span>
        <span>
          Valor entregado
          <strong>
            {money(
              prizes
                .filter((p) => p.status === "Entregado")
                .reduce((n, p) => n + p.value * p.quantity, 0),
            )}
          </strong>
        </span>
      </div>
      <div className="prize-list">
        {prizes.map((p) => (
          <article key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <small>
                {p.sponsor || "Sin patrocinador"} ·{" "}
                {p.place ? `${p.place}° lugar` : "Participación / general"} ·{" "}
                {p.quantity} × {money(p.value)}
              </small>
            </div>
            <select
              aria-label={`Estado de ${p.name}`}
              value={p.status}
              onChange={(e) =>
                setPrizes(
                  prizes.map((x) =>
                    x.id === p.id ? { ...x, status: e.target.value } : x,
                  ),
                )
              }
            >
              {["Propuesto", "Confirmado", "Entregado"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <strong>{money(p.value * p.quantity)}</strong>
            <button
              className="icon-button"
              aria-label={`Eliminar premio ${p.name}`}
              onClick={() => {
                if (confirm("¿Eliminar este premio del presupuesto?"))
                  setPrizes(prizes.filter((x) => x.id !== p.id));
              }}
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>
      <form
        className="operation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPrizes([
            ...prizes,
            {
              id: createId(),
              name: String(f.get("name")).trim(),
              sponsor: String(f.get("sponsor")).trim(),
              value: Number(f.get("value")),
              quantity: Number(f.get("quantity")),
              place: Number(f.get("place")),
              status: String(f.get("status")),
            },
          ]);
          e.currentTarget.reset();
        }}
      >
        <label>
          Nombre del premio
          <input name="name" required maxLength={150} />
        </label>
        <label>
          Patrocinador
          <input name="sponsor" maxLength={150} />
        </label>
        <label>
          Valor unitario (MXN)
          <input name="value" type="number" min={0} step={0.01} required />
        </label>
        <label>
          Cantidad
          <input
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
            required
          />
        </label>
        <label>
          Asignación
          <select name="place">
            <option value={0}>Participación / general</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}° lugar
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select name="status">
            {["Propuesto", "Confirmado", "Entregado"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="button primary">
          <Plus size={15} />
          Agregar premio
        </button>
      </form>
    </section>
  );
}
export function RegistrationSettings() {
  const local = useLocalEvent()!,
    [event, setEvent] = useLocal<Record<string, unknown>>("gj-event", {}),
    [capacity, setCapacity] = useLocal("gj-registration-capacity", 100),
    [message, setMessage] = useState("");
  const link =
    location.origin + "/?register=" + encodeURIComponent(local.jam.id);
  return (
    <section className="panel operation-panel">
      <h3>
        <LinkIcon size={18} />
        Inscripción de participantes
      </h3>
      <p>
        Comparte el enlace de esta edición. Cada persona completa su registro y
        tú confirmas su entrada. El enlace debe abrirse desde una dirección
        accesible a los participantes.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!event.registrationOpen}
          onChange={(e) =>
            setEvent({ ...event, registrationOpen: e.target.checked })
          }
        />
        Abrir inscripciones públicas
      </label>
      <label>
        Cupo de esta edición (máximo 100)
        <input
          type="number"
          min={1}
          max={100}
          value={capacity}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value > 0 && value <= 100)
              setCapacity(value);
          }}
        />
      </label>
      <label>
        Enlace de registro
        <input readOnly value={link} />
      </label>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setMessage("Enlace copiado");
          } catch {
            setMessage("Selecciona y copia el enlace del campo anterior.");
          }
        }}
      >
        <Copy size={15} />
        Copiar enlace
      </button>
      {message && <p role="status">{message}</p>}
      <p className="info-note">
        El comprobante se muestra al finalizar. Esta versión no envía emails de
        confirmación. En la red doméstica, comparte la dirección de la
        Raspberry; un enlace con localhost solo funciona en tu computadora.
      </p>
    </section>
  );
}
export function JudgeAccess() {
  const local = useLocalEvent()!,
    [access, setAccess] = useState<OrganizerAccess[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const data = await localApi<{ access: OrganizerAccess[] }>(
      `jams/${local.jam.id}/access`,
    );
    setAccess(data.access);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [local.jam.id]);
  return (
    <section className="panel operation-panel">
      <h3>
        <Users size={18} />
        Accesos del jurado y comité
      </h3>
      <p>
        Hasta cinco jueces por edición. Comparten la página de inicio y eligen{" "}
        <strong>
          {local.jam.name} · {local.jam.edition || "sin edición"}
        </strong>
        ; cada uno entra con su usuario o correo y su propia contraseña.
      </p>
      <p>
        Enlace de acceso: <a href={location.origin}>{location.origin}</a>. Las
        credenciales se comparten personalmente; no se envían por correo desde
        la app.
      </p>
      {access.map((user) => (
        <div className="access-row" key={user.id}>
          <span>
            <strong>{user.name}</strong> · {user.username}
            <small>
              {user.email} ·{" "}
              {user.role === "judge"
                ? "Jurado"
                : user.role === "staff"
                  ? "Comité"
                  : "Participante"}
            </small>
          </span>
          <button
            className="text-button"
            onClick={async () => {
              if (
                !confirm(
                  "¿Revocar este acceso? Las evaluaciones ya entregadas se conservan.",
                )
              )
                return;
              try {
                await localApi(`jams/${local.jam.id}/access/${user.id}`, {
                  method: "DELETE",
                });
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Revocar
          </button>
        </div>
      ))}
      <form
        className="operation-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await localApi<{ created: boolean }>(
              `jams/${local.jam.id}/access`,
              {
                method: "POST",
                body: JSON.stringify({
                  ...Object.fromEntries(new FormData(form).entries()),
                  role: String(new FormData(form).get("role")),
                }),
              },
            );
            setMessage(
              result.created
                ? "Acceso creado. Comparte al juez el nombre, la edición, su usuario y la contraseña que acabas de definir."
                : "Acceso concedido a una cuenta existente. Debe usar su contraseña actual.",
            );
            form.reset();
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nombre del acceso
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label>
          Usuario del acceso
          <input name="username" required minLength={3} maxLength={32} />
        </label>
        <label>
          Correo del acceso
          <input name="email" type="email" required maxLength={254} />
        </label>
        <label>
          Contraseña inicial
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
        <label>
          Perfil de acceso
          <select name="role">
            <option value="judge">Jurado</option>
            <option value="staff">Comité organizador</option>
          </select>
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Creando…" : "Crear acceso"}
        </button>
      </form>
      <p>
        Para dar acceso al comité, agrega antes su perfil en Comité organizador
        con el mismo correo. Para una cuenta nueva, define una contraseña de al
        menos ocho caracteres. Si el usuario y correo ya existen, se conserva la
        contraseña actual.
      </p>
      {error && (
        <p className="cloud-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
type OrganizerAccess = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
};
