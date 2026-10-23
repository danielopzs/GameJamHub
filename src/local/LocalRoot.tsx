import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Gamepad2,
  LogOut,
  Settings,
  Download,
  CheckCircle2,
} from "lucide-react";
import { STATIC_MODE } from "../runtime";
import {
  localApi,
  type LocalJam,
  type Organizer,
  type LocalSnapshot,
} from "./types";
import { LocalProvider, useLocalEvent } from "./store";
import { EventReview, hydratedJam } from "./EventReview";
import { GuestPortal, PublicRegistration, TicketPortal } from "./GuestPortals";
import { Onboarding } from "./Onboarding";
import "./local.css";
import "./operations.css";
type Selection = {
  name: string;
  edition?: string;
  exists: boolean;
  needsOwner?: boolean;
  id?: string;
};
export function LocalRoot({ children }: { children: ReactNode }) {
  const [name, setName] = useState("");
  const [edition, setEdition] = useState("");
  const [ticket, setTicket] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("ticket") || "",
  );
  const registerId = new URLSearchParams(location.search).get("register");
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [screen, setScreen] = useState<
    "search" | "credentials" | "onboarding" | "dashboard" | "review" | "portal"
  >("search");
  const [existingAccount, setExistingAccount] = useState(false);
  const [identity, setIdentity] = useState<{
    user: Organizer;
    jam: LocalJam;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (STATIC_MODE) return <>{children}</>;
  if (ticket) return <TicketPortal token={ticket} />;
  if (registerId)
    return (
      <PublicRegistration
        id={registerId}
        onTicket={(token) => {
          location.hash = "ticket=" + token;
          setTicket(token);
        }}
      />
    );
  if (screen === "portal" && identity)
    return (
      <GuestPortal jam={identity.jam} user={identity.user} onExit={logout} />
    );
  if (screen === "review" && snapshot)
    return (
      <EventReview
        snapshot={snapshot}
        onBack={() => setScreen("dashboard")}
        onEdit={() => {
          setEditing(true);
          setIdentity({ user: snapshot.user, jam: hydratedJam(snapshot) });
          setScreen("onboarding");
        }}
      />
    );
  async function open() {
    if (!identity) return;
    const data = await localApi<LocalSnapshot>(`jams/${identity.jam.id}`);
    setIdentity({ user: data.user, jam: data.jam });
    setSnapshot(data);
    setScreen("dashboard");
  }
  async function logout() {
    await localApi("logout", { method: "POST", body: "{}" });
    setIdentity(null);
    setSnapshot(null);
    setSelection(null);
    setName("");
    setEdition("");
    setError("");
    setScreen("search");
  }
  if (screen === "dashboard" && snapshot)
    return (
      <LocalProvider
        key={snapshot.jam.id + snapshot.user.id}
        initial={snapshot}
        onLogout={logout}
        onEdit={(latest) => {
          setSnapshot(latest);
          setIdentity({ user: latest.user, jam: hydratedJam(latest) });
          setScreen("review");
        }}
      >
        <LocalBar />
        {children}
      </LocalProvider>
    );
  if (screen === "onboarding" && identity)
    return (
      <Onboarding
        key={identity.jam.id}
        jam={identity.jam}
        editing={editing}
        user={identity.user}
        onDone={open}
        onExit={() => {
          if (editing) void open().catch((e) => setError(e.message));
          else void logout().catch((e) => setError(e.message));
        }}
      />
    );
  const login =
    (!!selection?.exists && !selection.needsOwner) || existingAccount;
  return (
    <div className="jam-entry">
      <section className="jam-access-card">
        <div className="jam-access-brand">
          <span className="brand-icon">
            <Gamepad2 size={28} />
          </span>
          <strong>
            gamejam<span>manager</span>
          </strong>
        </div>
        {screen === "search" ? (
          <>
            <span className="eyebrow">
              UN NOMBRE. UN EQUIPO. MUCHAS POSIBILIDADES.
            </span>
            <h1>¿En qué jam trabajaremos hoy?</h1>
            <p>
              Encuentra tu evento para continuar o comienza a organizar una
              nueva experiencia.
            </p>
            <form
              className="cloud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const result = await localApi<Selection>("lookup", {
                    method: "POST",
                    body: JSON.stringify({ name, edition }),
                  });
                  setSelection(result);
                  setExistingAccount(false);
                  setScreen("credentials");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Nombre del jam
                <input
                  name="jamName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={150}
                  required
                  placeholder="Ej. Monterrey Game Jam 2027"
                  autoFocus
                  autoComplete="off"
                />
              </label>
              <label>
                Edición del jam
                <input
                  name="edition"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  maxLength={60}
                  placeholder="Ej. 2027 o Primavera 2027"
                  autoComplete="off"
                />
              </label>
              <small>
                Ejemplo: nombre «Global Game Jam», edición «2027». Para eventos
                anteriores sin edición, deja este campo vacío.
              </small>
              {error && (
                <p className="cloud-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? "Buscando…" : "Continuar"}
                <ArrowRight size={17} />
              </button>
            </form>
            <p className="jam-access-note">
              El nombre identifica tu evento. Los datos se conservan en el
              servidor donde estás trabajando.
            </p>
          </>
        ) : (
          <>
            <button
              className="text-button jam-back"
              onClick={() => {
                setScreen("search");
                setError("");
              }}
            >
              <ArrowLeft size={14} />
              Cambiar jam
            </button>
            <span className="eyebrow">
              {selection?.needsOwner
                ? "RECUPERA TU EVENTO"
                : login
                  ? "QUÉ BUENO TENERTE DE VUELTA"
                  : "HAGAMOS QUE SUCEDA"}
            </span>
            <h1>
              {login
                ? `Continuemos con ${selection?.name} ${selection?.edition || ""}`
                : `Organicemos ${selection?.name} ${selection?.edition || ""}`}
            </h1>
            <p>
              {selection?.needsOwner
                ? "Encontramos datos de la versión anterior. Crea el primer acceso del organizador para conservarlos y completar la configuración."
                : login
                  ? "Ingresa las credenciales del organizador o del jurado para abrir el evento."
                  : "Este jam aún no está registrado. Crea tu perfil de organizador para comenzar."}
            </p>
            <form
              key={String(login)}
              className="cloud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const data = Object.fromEntries(form.entries());
                setBusy(true);
                setError("");
                try {
                  const result = await localApi<{
                    user: Organizer;
                    jam: LocalJam;
                  }>(login ? "login" : "register", {
                    method: "POST",
                    body: JSON.stringify({
                      ...data,
                      jamName: selection?.name,
                      edition: selection?.edition,
                      create:
                        existingAccount &&
                        (!selection?.exists || selection.needsOwner),
                    }),
                  });
                  setIdentity(result);
                  if (result.user.role && result.user.role !== "organizer") {
                    setScreen("portal");
                    return;
                  }
                  setEditing(false);
                  if (result.jam.onboarded) {
                    const initial = await localApi<LocalSnapshot>(
                      `jams/${result.jam.id}`,
                    );
                    setSnapshot(initial);
                    setScreen("dashboard");
                  } else setScreen("onboarding");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {login ? (
                <label>
                  Usuario o correo
                  <input
                    name="identifier"
                    required
                    autoComplete="username"
                    maxLength={254}
                  />
                </label>
              ) : (
                <>
                  <label>
                    Nombre completo
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Usuario
                    <input
                      name="username"
                      required
                      minLength={3}
                      maxLength={32}
                      pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,31}"
                      autoComplete="username"
                      placeholder="Ej. ana.garcia"
                    />
                  </label>
                  <label>
                    Correo
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Tipo de acceso
                    <select name="credentialType">
                      <option value="password">
                        Contraseña (8 caracteres o más)
                      </option>
                      <option value="pin">PIN numérico (6 a 12 dígitos)</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                {login ? "Contraseña o PIN" : "Contraseña / PIN"}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={login ? 1 : 6}
                  maxLength={128}
                  autoComplete={login ? "current-password" : "new-password"}
                />
              </label>
              {error && (
                <p className="cloud-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" type="submit" disabled={busy}>
                {busy
                  ? "Preparando tu espacio…"
                  : login
                    ? "Entrar al jam"
                    : "Registrarme y continuar"}
                <ArrowRight size={17} />
              </button>
            </form>
            {(!selection?.exists || selection.needsOwner) && (
              <button
                className="text-button"
                onClick={() => {
                  setExistingAccount(!existingAccount);
                  setError("");
                }}
              >
                {existingAccount
                  ? "Crear mi cuenta de organizador"
                  : "Ya tengo cuenta de organizador"}
              </button>
            )}
            <p className="jam-access-note">
              El correo sirve como contacto y acceso. En este modo local no
              necesitas verificarlo por email.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
function LocalBar() {
  const local = useLocalEvent()!;
  const [error, setError] = useState("");
  return (
    <>
      <div className="local-bar">
        <strong>
          <Gamepad2 size={16} />
          {local.jam.name} {local.jam.edition}
        </strong>
        <span className="local-sync">
          <CheckCircle2 size={14} />
          {local.pending
            ? `${local.pending} cambios pendientes`
            : local.busy
              ? "Sincronizando…"
              : `Guardado ${local.lastSync}`}
        </span>
        <div>
          <button
            className="text-button"
            onClick={() => {
              if (local.pending) {
                setError(
                  "Espera a que se guarden los cambios antes de editar las respuestas.",
                );
                return;
              }
              setError("");
              void local.editSetup().catch((e) => setError(e.message));
            }}
          >
            <Settings size={15} />
            Respuestas del evento
          </button>
          <span>{local.user.name}</span>
          <button
            className="icon-button"
            aria-label="Salir del jam"
            onClick={() => {
              void local.logout().catch((e) => setError(e.message));
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
      {(local.error || error) && (
        <div className="local-error" role="alert">
          <p>{local.error || error}</p>
          <button className="text-button" onClick={local.download}>
            <Download size={14} />
            Descargar borrador
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (
                confirm(
                  "¿Descartar el borrador local y recuperar los datos guardados?",
                )
              )
                void local.discard().then(() => setError(""));
            }}
          >
            Descartar borrador y recargar
          </button>
        </div>
      )}
    </>
  );
}
