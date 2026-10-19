import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Gamepad2,
  ArrowRight,
  LogOut,
  Plus,
  Cloud,
  Settings,
  Check,
  Download,
  Users,
  X,
} from "lucide-react";
import { supabase, configurationError } from "./client";
import { CloudProvider, useCloud } from "./store";
import { createSeed } from "./seed";
import type { CloudEvent } from "./types";
import { CLOUD_BUILD } from "../runtime";
import { Dialog } from "../Dialog";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : (e as { message?: string })?.message ||
      "No se pudo completar la operación.";
export function CloudRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* HTTPS/browser support may be unavailable in local tests. */
      });
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [demo, setDemo] = useState(false);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [selected, setSelected] = useState<CloudEvent | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const listKey = user ? `gj-cloud-events:${user.id}` : "";
  async function loadEvents() {
    if (!user) return;
    const { data, error } = await supabase!
      .from("jam_events")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      setError(message(error) + " Comprueba que ejecutaste la migración SQL.");
      const cached = localStorage.getItem(listKey);
      if (cached) setEvents(JSON.parse(cached));
      return;
    }
    setEvents(data || []);
    localStorage.setItem(listKey, JSON.stringify(data || []));
    setError("");
  }
  useEffect(() => {
    if (!CLOUD_BUILD || !supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setUser(data.session?.user || null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setSelected(null);
    setEvents([]);
    if (user) void loadEvents();
  }, [user?.id]);
  async function logout() {
    const pending = Object.keys(localStorage).some((key) => {
      if (!key.startsWith("gj-cloud:")) return false;
      try {
        return (
          Object.keys(
            JSON.parse(localStorage.getItem(key) || "{}").drafts || {},
          ).length > 0
        );
      } catch {
        return false;
      }
    });
    if (
      pending &&
      !confirm(
        "Hay cambios pendientes sin sincronizar. Cerrar sesión borrará los datos locales. Cancela para descargar el borrador o esperar la sincronización. ¿Cerrar de todos modos?",
      )
    )
      return;

    if (!navigator.onLine) {
      setError("Conéctate para cerrar la sesión de Supabase.");
      return;
    }
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) {
      setError(error.message);
      return;
    }
    for (const key of Object.keys(localStorage))
      if (key.startsWith("gj-cloud")) localStorage.removeItem(key);
    setSelected(null);
    setEvents([]);
  }
  if (!CLOUD_BUILD) return <>{children}</>;
  if (configurationError() && !demo)
    return (
      <div className="cloud-screen">
        <section className="panel cloud-card setup-card">
          <span className="brand-icon">
            <Gamepad2 size={28} />
          </span>
          <span className="eyebrow">
            GAME JAM MANAGER · SUPABASE + NETLIFY FREE
          </span>
          <h1>Tu próximo jam, conectado.</h1>
          <p>{configurationError()}</p>
          <ol>
            <li>
              Crea un proyecto Free en Supabase y ejecuta{" "}
              <code>supabase/migrations/001_gamejam.sql</code> en SQL Editor.
            </li>
            <li>
              Para subir la carpeta manualmente: abre <code>config.js</code>,
              agrega la URL y la clave pública del proyecto y vuelve a publicar
              la carpeta.
            </li>
            <li>
              Si despliegas desde GitHub: agrega <code>VITE_SUPABASE_URL</code>{" "}
              y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en Netlify y genera
              un nuevo despliegue.
            </li>
          </ol>
          <p className="info-note">
            No pegues claves secretas o service_role en la aplicación. La clave
            pública usa permisos RLS en la base de datos.
          </p>
          <button className="button primary" onClick={() => setDemo(true)}>
            Explorar demo local <ArrowRight size={16} />
          </button>
          <small>
            La demo guarda datos solo en este navegador; no tiene conexión a
            Supabase.
          </small>
        </section>
      </div>
    );
  if (demo)
    return (
      <>
        <div className="demo-banner">
          Demo local · sin conexión a Supabase{" "}
          <button onClick={() => setDemo(false)}>Volver a configuración</button>
        </div>
        {children}
      </>
    );
  if (loading)
    return (
      <div className="cloud-screen">
        <p>Restaurando sesión…</p>
      </div>
    );
  if (!user || recovery)
    return (
      <AuthForm recovery={recovery} onRecovered={() => setRecovery(false)} />
    );
  if (selected)
    return (
      <CloudProvider
        key={selected.id + user.id}
        event={selected}
        user={user}
        onBack={() => setSelected(null)}
      >
        <CloudBar
          onBack={() => {
            setSelected(null);
            void loadEvents();
          }}
          onLogout={logout}
        />
        {children}
      </CloudProvider>
    );
  return (
    <div className="cloud-screen event-picker">
      <section className="picker-content">
        <div className="section-heading">
          <div className="brand">
            <span className="brand-icon">
              <Gamepad2 size={24} />
            </span>
            gamejam<span className="brand-light">manager</span>
          </div>
          <button className="button secondary" onClick={logout}>
            <LogOut size={15} />
            Salir
          </button>
        </div>
        <div className="picker-heading">
          <span className="eyebrow">TU ESPACIO DE ORGANIZACIÓN</span>
          <h1>Seis eventos. Infinitas posibilidades.</h1>
          <p>
            {user.email} · Selecciona un evento o comienza una nueva edición.
          </p>
        </div>
        {error && (
          <p className="cloud-error" role="alert">
            {error}
          </p>
        )}
        <div className="event-card-grid">
          {events.map((event) => (
            <button
              className="panel event-choice"
              key={event.id}
              onClick={() => setSelected(event)}
            >
              <span className="stat-icon purple">
                <Gamepad2 size={22} />
              </span>
              <h3>{event.name}</h3>
              <p>
                {event.owner_id === user.id
                  ? "Anfitrión propietario"
                  : "Acceso por invitación"}
              </p>
              <span className="text-button">
                Abrir evento <ArrowRight size={15} />
              </span>
            </button>
          ))}
          <button
            className="panel event-choice new-event"
            onClick={() => setCreating(true)}
            disabled={events.filter((e) => e.owner_id === user.id).length >= 6}
          >
            <span className="stat-icon blue">
              <Plus size={22} />
            </span>
            <h3>Crear evento</h3>
            <p>Hasta 6 ediciones por anfitrión</p>
          </button>
        </div>
        {!events.length && (
          <p className="info-note">
            Si eres juez, pide al organizador que agregue tu correo exacto en
            Accesos del evento. Si eres anfitrión, crea tu primer evento.
          </p>
        )}
        <button className="text-button" onClick={() => void loadEvents()}>
          Actualizar mis accesos
        </button>
      </section>
      {creating && (
        <Dialog onClose={() => setCreating(false)}>
          <h3>Un nuevo comienzo</h3>
          <form
            className="cloud-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const name = String(form.get("name") || "").trim();
              setCreating(false);
              try {
                const displayName = String(
                  user.user_metadata.full_name || user.email,
                );
                let previous;
                const reuse = String(form.get("reuse") || "");
                if (
                  events.some((e) => e.id === reuse && e.owner_id === user.id)
                ) {
                  const result = await supabase!
                    .from("jam_state")
                    .select("key,value")
                    .eq("event_id", reuse)
                    .in("key", ["gj-host", "gj-hosts"]);
                  if (result.error) throw result.error;
                  previous = Object.fromEntries(
                    (result.data || []).map((r) => [r.key, r.value]),
                  );
                }
                const { data, error } = await supabase!.rpc(
                  "jam_create_event",
                  {
                    p_name: name,
                    p_seed: createSeed(
                      name,
                      user.email || "",
                      displayName,
                      previous,
                    ),
                  },
                );
                if (error) throw error;
                await loadEvents();
                setSelected({
                  id: data,
                  name,
                  owner_id: user.id,
                  created_at: new Date().toISOString(),
                });
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            <label>
              Nombre del evento
              <input
                required
                maxLength={150}
                name="name"
                placeholder="Mi Game Jam 2027"
                autoFocus
              />
            </label>
            {events.some((e) => e.owner_id === user.id) && (
              <label>
                Reutilizar anfitrión y sedes
                <select name="reuse">
                  <option value="">Crear un perfil para esta edición</option>
                  {events
                    .filter((e) => e.owner_id === user.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <p className="info-note">
              Se crean las 31 tareas sin completar. Tu evento comienza vacío,
              sin equipos, participantes ni votos ficticios.
            </p>
            <button className="button primary" type="submit">
              Crear evento <Plus size={15} />
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
function AuthForm({
  recovery,
  onRecovered,
}: {
  recovery: boolean;
  onRecovered: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <div className="cloud-screen">
      <section className="panel cloud-card">
        <span className="brand-icon">
          <Gamepad2 size={27} />
        </span>
        <span className="eyebrow">TU COMUNIDAD. TUS EVENTOS.</span>
        <h1>
          {recovery
            ? "Elige tu nueva contraseña"
            : mode === "signup"
              ? "Crea tu espacio."
              : mode === "reset"
                ? "Recupera tu acceso."
                : "Bienvenido de nuevo."}
        </h1>
        <p>Una cuenta para organizar, colaborar y evaluar con tu equipo.</p>
        {error && (
          <p className="cloud-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="cloud-notice" role="status">
            {notice}
          </p>
        )}
        <form
          className="cloud-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setNotice("");
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const email = String(f.get("email") || "").trim();
            const password = String(f.get("password") || "");
            try {
              if (recovery) {
                const { error } = await supabase!.auth.updateUser({ password });
                if (error) throw error;
                onRecovered();
              } else if (mode === "login") {
                const { error } = await supabase!.auth.signInWithPassword({
                  email,
                  password,
                });
                if (error) throw error;
              } else if (mode === "signup") {
                const { error, data } = await supabase!.auth.signUp({
                  email,
                  password,
                  options: {
                    data: { full_name: String(f.get("name") || "") },
                    emailRedirectTo: window.location.origin,
                  },
                });
                if (error) throw error;
                if (!data.session)
                  setNotice(
                    "Confirma tu correo para activar la cuenta. Si el proyecto usa el correo de prueba de Supabase, pide al anfitrión que cree tu usuario confirmado desde el Dashboard.",
                  );
              } else {
                const { error } = await supabase!.auth.resetPasswordForEmail(
                  email,
                  { redirectTo: window.location.origin },
                );
                if (error) throw error;
                setNotice(
                  "Si el correo está registrado y el envío está configurado, recibirás las instrucciones.",
                );
              }
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && !recovery && (
            <label>
              Nombre completo
              <input name="name" required maxLength={120} autoComplete="name" />
            </label>
          )}
          {!recovery && (
            <label>
              Correo electrónico
              <input type="email" name="email" required autoComplete="email" />
            </label>
          )}
          {(recovery || mode !== "reset") && (
            <label>
              Contraseña
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy
              ? "Conectando…"
              : recovery
                ? "Guardar contraseña"
                : mode === "signup"
                  ? "Crear cuenta"
                  : mode === "reset"
                    ? "Enviar instrucciones"
                    : "Entrar a mi espacio"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!recovery && (
          <div className="auth-links">
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
                setNotice("");
              }}
            >
              {mode === "signup" ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "reset" ? "login" : "reset");
                setError("");
                setNotice("");
              }}
            >
              {mode === "reset"
                ? "Volver a iniciar sesión"
                : "Olvidé mi contraseña"}
            </button>
          </div>
        )}
        <small>
          Los datos de cada evento están protegidos por permisos en Supabase.
        </small>
      </section>
    </div>
  );
}
function CloudBar({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const cloud = useCloud()!;
  const [access, setAccess] = useState(false);
  const [account, setAccount] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="cloud-bar">
        <button className="text-button" onClick={onBack}>
          Mis eventos <ArrowRight size={13} />
        </button>
        <span>
          <Cloud size={14} />
          {cloud.pending
            ? `${cloud.pending} cambios pendientes`
            : cloud.busy
              ? "Sincronizando…"
              : `Sincronizado ${cloud.lastSync}`}
        </span>
        <div>
          {cloud.organizer && (
            <button className="text-button" onClick={() => setAccess(true)}>
              <Users size={14} />
              Accesos del evento
            </button>
          )}
          <span className="subtle-chip">
            {cloud.actor} · {cloud.organizer ? "Organización" : "Juez"}
          </span>
          <button
            className="icon-button"
            aria-label="Mi cuenta"
            onClick={() => {
              setAccount(true);
              setAccountNotice("");
              setError("");
            }}
          >
            <Settings size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Cerrar sesión"
            onClick={onLogout}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
      {cloud.error && (
        <div className="cloud-sync-error" role="alert">
          <p>{cloud.error}</p>
          <button
            className="text-button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(cloud.snapshot, null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "gamejam-borrador-pendiente.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Download size={14} />
            Descargar borrador
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (
                confirm(
                  "¿Descartar los cambios locales pendientes y recuperar la versión del servidor? Descarga antes tu borrador.",
                )
              )
                void cloud.discard();
            }}
          >
            Descartar borrador y recargar
          </button>
        </div>
      )}
      {account && (
        <Dialog onClose={() => setAccount(false)}>
          <div className="section-heading">
            <h3>Mi cuenta</h3>
            <button
              className="icon-button"
              aria-label="Cerrar"
              onClick={() => setAccount(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="muted">{cloud.actor}</p>
          {error && (
            <p className="cloud-error" role="alert">
              {error}
            </p>
          )}
          {accountNotice && (
            <p className="cloud-notice" role="status">
              {accountNotice}
            </p>
          )}
          <form
            className="cloud-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const password = String(f.get("password"));
              if (password !== f.get("confirm")) {
                setError("Las contraseñas no coinciden");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const { error } = await supabase!.auth.updateUser({ password });
                if (error) throw error;
                form.reset();
                setAccountNotice("Contraseña actualizada");
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button className="button primary" disabled={busy} type="submit">
              Cambiar contraseña
            </button>
          </form>
        </Dialog>
      )}
      {access && (
        <Dialog onClose={() => setAccess(false)}>
          <div className="section-heading">
            <h3>Accesos al evento</h3>
            <button
              className="icon-button"
              aria-label="Cerrar"
              onClick={() => setAccess(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="muted">
            Hasta 10 organizadores y 5 jueces. El comité operativo se gestiona
            por separado.
          </p>
          {error && (
            <p className="cloud-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="cloud-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              setBusy(true);
              setError("");
              try {
                await cloud.invite(
                  String(f.get("email")).toLowerCase().trim(),
                  String(f.get("name")).trim(),
                  String(f.get("role")),
                );
                form.reset();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nombre
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Correo de su cuenta
              <input type="email" name="email" required />
            </label>
            <label>
              Permiso
              <select name="role">
                <option value="organizer">Organizador</option>
                <option value="judge">Juez</option>
              </select>
            </label>
            <button type="submit" className="button primary" disabled={busy}>
              <Plus size={15} />
              Dar acceso
            </button>
          </form>
          <p className="info-note">
            Esto autoriza el correo; no envía un email ni crea una cuenta. La
            persona debe registrarse y confirmar ese mismo correo, o el
            anfitrión puede crear su usuario desde Supabase. Para que el
            anfitrión también evalúe, agrega su correo con permiso de Juez;
            conserva sus derechos de propietario.
          </p>
          <div className="access-list">
            {cloud.members.map((m) => (
              <div key={m.email}>
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {m.email} · {m.role === "judge" ? "Juez" : "Organizador"}
                  </small>
                </span>
                <button
                  className="text-button danger"
                  disabled={busy || m.email === cloud.actor}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await cloud.remove(m.email);
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
