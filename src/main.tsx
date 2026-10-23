import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Trophy,
  Settings,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Plus,
  CalendarDays,
  MapPin,
  MoreHorizontal,
  Check,
  Clock,
  ArrowRight,
  Gamepad2,
  PanelLeftClose,
  Sun,
  Moon,
  X,
  Download,
  WifiOff,
  Flag,
  LayoutGrid,
  ChartNoAxesGantt,
  CheckCircle2,
} from "lucide-react";
import { initialTasks, roles, phases, criteria, reminders } from "./data";
import "./style.css";
import { useLocal } from "./storage";
import { PushControls } from "./PushControls";
import { Avatar } from "./Avatar";
import { TaskTable } from "./TaskTable";
import { Dialog } from "./Dialog";
import { STATIC_MODE } from "./runtime";
import { LocalRoot } from "./local/LocalRoot";
import { useLocalEvent } from "./local/store";
import {
  EventMetrics,
  PrizeBudget,
  JudgeAccess,
  RegistrationSettings,
  type Prize,
} from "./local/EventOperations";
import { Timeline } from "./local/Timeline";
import {
  OperationalReminders,
  ReminderBanner,
  NextReminderCard,
} from "./local/Reminders";
import { EventOverview } from "./local/EventOverview";
import { jamDate, taskDate, inputDate } from "./local/dates";
import { CloudRoot } from "./cloud/CloudRoot";
import { useCloud } from "./cloud/store";
import { Participants } from "./cloud/Participants";
const initialMembers = [
  {
    name: "Ana García",
    email: "ana@gamejam.mx",
    role: roles[0],
    color: "purple",
  },
  {
    name: "Carlos Ruiz",
    email: "carlos@gamejam.mx",
    role: roles[1],
    color: "blue",
  },
  {
    name: "Mariana López",
    email: "mariana@gamejam.mx",
    role: roles[2],
    color: "pink",
  },
  {
    name: "Diego Torres",
    email: "diego@gamejam.mx",
    role: roles[4],
    color: "orange",
  },
];
function App() {
  const local = useLocalEvent();
  const cloud = useCloud();
  const [page, setPage] = useState(
    cloud && !cloud.organizer ? "Evaluación y premios" : "Resumen",
  );
  const [tasks, setTasks] = useLocal("gj-tasks", initialTasks);
  const [prizes] = useLocal<Prize[]>("gj-prizes", []);
  const [members, setMembers] = useLocal("gj-members", initialMembers);
  const [event, setEvent] = useLocal("gj-event", {
    name: "Global Game Jam 2026",
    edition: "",
    planningStart: "",
    platform: "",
    registrationOpen: false,
    start: "2026-01-30T17:00",
    end: "2026-02-01T17:00",
    mode: "Presencial",
    venue: "Centro de Innovación · Monterrey",
    framework: true,
    frameworkName: "Festival de Videojuegos MTY",
    vip: true,
  });
  const [host, setHost] = useLocal("gj-host", {
    name: "Ana García",
    email: "ana@gamejam.mx",
    organization: "Game Dev Monterrey",
    venue: "Centro de Innovación · Monterrey",
    sponsors: "Unity, Xbox, Red Bull",
  });
  const [masters, setMasters] = useLocal<(typeof host)[]>("gj-hosts", []);
  const [dark, setDark] = useLocal("gj-dark", false);
  const [view, setView] = useState("Tabla");
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [teams, setTeams] = useLocal("gj-teams", [
    {
      code: "T01",
      name: "Pixel Pioneers",
      game: "Echoes of Tomorrow",
      time: "16:00",
      votes: 42,
    },
    {
      code: "T02",
      name: "Ctrl + Create",
      game: "Little Orbit",
      time: "16:10",
      votes: 38,
    },
    {
      code: "T03",
      name: "Midnight Studio",
      game: "Rooted",
      time: "16:20",
      votes: 29,
    },
  ]);
  const [judges, setJudges] = useLocal("gj-judges", [
    "Sofía Martínez",
    "Andrés Molina",
  ]);
  const [evaluations, setEvaluations] = useLocal<Record<string, number[]>>(
    "gj-evaluations",
    {},
  );
  const [judge, setJudge] = useState(cloud?.actor || judges[0] || "");
  const [team, setTeam] = useState(teams[0]?.code || "T01");
  const [scores, setScores] = useState<number[]>(criteria.map(() => 0));
  const [weight, setWeight] = useLocal("gj-weight", 85);
  const [mobile, setMobile] = useState(false);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);
  useEffect(() => {
    if (local || !("Notification" in window)) return;
    const check = () => {
      if (Notification.permission !== "granted") return;
      reminders.forEach((r, i) => {
        const when = new Date(event.start).getTime() + r.day * 86400000;
        const key = `gj-sent-${cloud?.event.id || "demo"}-${event.start}-${i}`;
        if (
          Date.now() >= when &&
          Date.now() - when < 86400000 &&
          !localStorage.getItem(key)
        ) {
          navigator.serviceWorker.ready.then(async (reg) => {
            if (!(await reg.pushManager?.getSubscription()))
              await reg.showNotification(r.role, {
                body: r.text,
                icon: "/icon.svg",
              });
          });
          localStorage.setItem(key, "1");
        }
      });
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [event.start, local?.jam.id, cloud?.event.id]);
  useEffect(() => {
    setScores(evaluations[`${judge}:${team}`] || criteria.map(() => 0));
  }, [judge, team, evaluations]);
  useEffect(() => {
    if (!teams.some((t) => t.code === team)) setTeam(teams[0]?.code || "");
  }, [teams, team]);
  const completed = tasks.filter((t) => t.status === "Completada").length;
  const activePhase = tasks
    .filter((t) => t.status !== "Completada")
    .reduce((phase, t) => Math.min(phase, t.phase), 5);
  const progress = Math.round((completed / Math.max(1, tasks.length)) * 100);
  const filtered = tasks.filter(
    (t) =>
      (filter === "Todos" || t.owner === filter) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  const updateTask = (id: number, status: string) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  const navigate = (p: string) => {
    setPage(
      cloud &&
        !cloud.organizer &&
        !["Evaluación y premios", "Recordatorios"].includes(p)
        ? "Evaluación y premios"
        : p,
    );
    setMobile(false);
    setQuery("");
  };
  const priorities = ["Crítica", "Alta", "Media", "Baja"];
  const localLeaderboard = teams
    .map((t) => {
      const ratings = Object.entries(evaluations)
        .filter(([k]) => k.endsWith(":" + t.code))
        .map(([, s]) => s.reduce((a, b) => a + b, 0));
      const average = ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      const publicScore =
        (t.votes / Math.max(1, ...teams.map((t) => t.votes))) * 120;
      return {
        ...t,
        average,
        count: ratings.length,
        total: (average * weight) / 100 + (publicScore * (100 - weight)) / 100,
      };
    })
    .sort((a, b) => b.total - a.total);
  const leaderboard = cloud
    ? teams
        .map((t) => {
          const row = cloud.ranking.find((r) => r.team_code === t.code);
          return {
            ...t,
            count: Number(row?.judge_count || 0),
            average: Number(row?.jury_average || 0),
            total: Number(row?.total || 0),
          };
        })
        .sort((a, b) => b.total - a.total)
    : localLeaderboard;
  return (
    <div
      className={`app ${local ? "local-view" : ""} ${cloud && !cloud.organizer ? "judge-view" : ""}`}
    >
      <aside className={mobile ? "sidebar mobile-open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Resumen");
          }}
        >
          <span className="brand-icon">
            <Gamepad2 size={23} />
          </span>
          <span>
            gamejam<span className="brand-light">manager</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button
          className="workspace-switch"
          onClick={() => {
            if (!cloud || cloud.organizer) setModal("event");
          }}
        >
          <span className="workspace-icon">G</span>
          <span>
            {host.organization}
            <small>Espacio de organización</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">GESTIÓN DEL EVENTO</div>
        <nav>
          {[
            [LayoutDashboard, "Resumen"],
            [ListTodo, "Tareas"],
            [Users, "Comité organizador"],
            [Trophy, "Evaluación y premios"],
            [Bell, "Recordatorios"],
            ...(cloud?.organizer || local ? [[Users, "Participantes"]] : []),
            ...(local
              ? [
                  [Trophy, "Premios"],
                  [Users, "Accesos del jurado"],
                ]
              : []),
          ]
            .filter(
              ([, label]) =>
                !cloud ||
                cloud.organizer ||
                ["Evaluación y premios", "Recordatorios"].includes(
                  String(label),
                ),
            )
            .map(([Icon, label]) => (
              <button
                key={String(label)}
                className={page === label ? "active" : ""}
                onClick={() => navigate(String(label))}
              >
                {React.createElement(Icon as typeof Bell, { size: 19 })}
                <span>{String(label)}</span>
                {label === "Tareas" && (
                  <span className="nav-count">{tasks.length}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-event">
          <span className="live-dot" /> PRÓXIMO EVENTO
          <h4>
            {event.name} {local?.jam.edition}
          </h4>
          <p>
            {jamDate(event.start, {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {jamDate(event.end, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <div className="mini-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="between">
            <span>Preparación</span>
            <strong>{progress}%</strong>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            hidden={!!cloud && !cloud.organizer}
            className="settings-nav"
            onClick={() => navigate("Configuración")}
          >
            <Settings size={18} />
            Configuración
          </button>
          <div className="profile">
            <Avatar name={cloud?.actor || host.name} />
            <div>
              <strong>{cloud?.actor || host.name}</strong>
              <small>Anfitriona del evento</small>
            </div>
            <button
              className="icon-button"
              aria-label="Editar perfil"
              onClick={() => setModal("host")}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Abrir menú"
              onClick={() => setMobile(!mobile)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="saved">
              <i />
              {!online
                ? "Modo sin conexión"
                : local
                  ? local.error
                    ? "Revisar sincronización"
                    : local.pending
                      ? "Cambios pendientes"
                      : local.busy
                        ? "Sincronizando…"
                        : "Guardado en el servidor local"
                  : "Guardado en este dispositivo"}
            </span>
            <button
              className="icon-button"
              aria-label="Cambiar tema"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification-bell"
              aria-label="Ver notificaciones"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
              <i />
            </button>
            <Avatar name={cloud?.actor || host.name} small />
          </div>
          {notifications && (
            <div className="notification-panel">
              <strong>Tus recordatorios</strong>
              {(local ? [] : reminders).map((r, i) => (
                <div key={i}>
                  <small>
                    {r.role} · {r.day < 0 ? `T${r.day} días` : "Hora 46"}
                  </small>
                  <p>{r.text}</p>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() => {
                  navigate("Recordatorios");
                  setNotifications(false);
                }}
              >
                Gestionar recordatorios <ArrowRight size={14} />
              </button>
            </div>
          )}
        </header>
        <main>
          {!online && (
            <div className="offline">
              <WifiOff size={16} /> Trabajas sin conexión. Los cambios se
              guardan en este dispositivo.
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                TU PRÓXIMA GRAN EXPERIENCIA EMPIEZA AQUÍ
              </div>
              <h1>
                {page === "Resumen"
                  ? "Un gran jam empieza con un gran plan."
                  : page}
              </h1>
              <p>
                {page === "Resumen"
                  ? "Todo tu evento, tu equipo y tus ideas. En un solo lugar."
                  : page === "Tareas"
                    ? "Del primer boceto al último build. Cada detalle cuenta."
                    : page === "Comité organizador"
                      ? "Las personas que hacen que todo suceda."
                      : page === "Evaluación y premios"
                        ? "Grandes ideas merecen una evaluación extraordinaria."
                        : page === "Recordatorios"
                          ? "El mensaje correcto, en el momento correcto."
                          : "Tu evento, a tu manera."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                if (!cloud || cloud.organizer) setModal("event");
              }}
            >
              <Settings size={16} /> Editar evento
            </button>
          </div>
          {page === "Resumen" && (
            <>
              {local && (
                <ReminderBanner onOpen={() => navigate("Recordatorios")} />
              )}
              <section className="event-hero">
                <div className="hero-content">
                  <div className="hero-badges">
                    <span>
                      <i /> EN PREPARACIÓN
                    </span>
                    <span>
                      {local?.jam.edition
                        ? `EDICIÓN ${local.jam.edition}`
                        : event.start
                          ? `EDICIÓN ${new Date(event.start).getFullYear()}`
                          : "FECHAS POR DEFINIR"}
                    </span>
                  </div>
                  <h2>
                    {event.name} {local?.jam.edition}
                    <span>
                      {local
                        ? "Tu comunidad. Una edición inolvidable."
                        : "48 horas. Infinitas posibilidades."}
                    </span>
                  </h2>
                  <div className="hero-meta">
                    <span>
                      <CalendarDays size={15} />
                      {jamDate(event.start, {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      –{" "}
                      {jamDate(event.end, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>
                      <MapPin size={15} />
                      {event.venue.split(" · ")[0]}
                    </span>
                    <span className="mode">
                      <i />
                      {event.mode}
                    </span>
                  </div>
                  <button
                    className="hero-link"
                    onClick={() => {
                      if (!cloud || cloud.organizer) setModal("event");
                    }}
                  >
                    Ver detalles del evento <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="spark s1">✦</div>
                  <div className="spark s2">✧</div>
                  <div className="float-dot" />
                  <div className="controller">
                    <div className="controller-plus" />
                    <div className="controller-buttons">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="controller-stick a" />
                    <div className="controller-stick b" />
                    <div className="controller-center" />
                  </div>
                  <span className="art-caption">
                    LET’S MAKE SOMETHING GREAT
                  </span>
                </div>
              </section>
              <EventOverview
                tasks={tasks}
                start={event.start}
                onTasks={() => navigate("Tareas")}
                onDates={() => setModal("event")}
              />
              {local && <EventMetrics />}
              <section className="stats">
                <div className="stat-card">
                  <span className="stat-icon purple">
                    <ListTodo size={20} />
                  </span>
                  <span className="stat-label">
                    Progreso general <ArrowUpRight size={14} />
                  </span>
                  <div className="stat-value">
                    {progress}
                    <span>%</span>
                    <em className="positive">En marcha</em>
                  </div>
                  <div className="stat-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small>
                    {completed} de {tasks.length} tareas completadas
                  </small>
                </div>
                <div className="stat-card">
                  <span className="stat-icon blue">
                    <Users size={20} />
                  </span>
                  <span className="stat-label">
                    Comité organizador <ArrowUpRight size={14} />
                  </span>
                  <div className="stat-value">
                    {members.length.toString().padStart(2, "0")}
                    <em>miembros</em>
                  </div>
                  <div className="avatar-stack">
                    {members.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.name}
                        name={m.name}
                        color={m.color}
                        small
                      />
                    ))}
                    <button onClick={() => setModal("member")}>+</button>
                  </div>
                  <small>Un equipo, una misma visión</small>
                </div>
                <div className="stat-card">
                  <span className="stat-icon orange">
                    <Flag size={20} />
                  </span>
                  <span className="stat-label">
                    Tareas prioritarias <ArrowUpRight size={14} />
                  </span>
                  <div className="stat-value">
                    {tasks
                      .filter(
                        (t) => t.priority < 2 && t.status !== "Completada",
                      )
                      .length.toString()
                      .padStart(2, "0")}
                    <em className="attention">Requieren atención</em>
                  </div>
                  <div className="priority-count">
                    <i />
                    {
                      tasks.filter(
                        (t) => t.priority === 0 && t.status !== "Completada",
                      ).length
                    }{" "}
                    críticas <span>·</span>
                    <b />
                    {
                      tasks.filter(
                        (t) => t.priority === 1 && t.status !== "Completada",
                      ).length
                    }{" "}
                    altas
                  </div>
                  <small>Cada detalle hace la diferencia</small>
                </div>
                <div className="stat-card">
                  <span className="stat-icon green">
                    <Trophy size={20} />
                  </span>
                  <span className="stat-label">
                    Equipos registrados <ArrowUpRight size={14} />
                  </span>
                  <div className="stat-value">
                    {teams.length.toString().padStart(2, "0")}
                    <em>equipos</em>
                  </div>
                  <button
                    className="text-button green-text"
                    onClick={() => navigate("Evaluación y premios")}
                  >
                    Gestionar participantes <ArrowRight size={13} />
                  </button>
                  <small>El próximo gran juego empieza aquí</small>
                </div>
              </section>
              <div className="overview-grid">
                <section className="panel phases-panel">
                  <div className="section-heading">
                    <div>
                      <h3>El camino hacia el jam</h3>
                      <p>Seis fases. Un evento inolvidable.</p>
                    </div>
                    <span className="subtle-chip">6 fases</span>
                  </div>
                  <div className="phase-line">
                    {phases.map((p, i) => {
                      const total = tasks.filter((t) => t.phase === i);
                      const done = total.filter(
                        (t) => t.status === "Completada",
                      ).length;
                      return (
                        <button
                          key={p}
                          className={`phase ${total.length && done === total.length ? "phase-done" : i === activePhase ? "phase-active" : ""}`}
                          onClick={() => {
                            navigate("Tareas");
                            setQuery("");
                            setFilter("Todos");
                          }}
                        >
                          <span className="phase-circle">
                            {total.length > 0 && done === total.length ? (
                              <Check size={17} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <small>{p.split(" · ")[1] || "T+3d"}</small>
                          <strong>
                            {
                              [
                                "Planeación",
                                "Producción",
                                "Difusión",
                                "Últimos detalles",
                                "Game jam",
                                "Post-mortem",
                              ][i]
                            }
                          </strong>
                          <span>
                            {done}/{total.length} tareas
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="phase-footer">
                    <span>
                      <span className="live-dot" /> Estás en la fase de{" "}
                      <strong>{phases[activePhase].split(" · ")[0]}</strong>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        navigate("Tareas");
                        setView("Cronograma");
                      }}
                    >
                      Ver cronograma <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                {local ? (
                  <NextReminderCard onOpen={() => navigate("Recordatorios")} />
                ) : (
                  <section className="panel next-panel">
                    <div className="section-heading">
                      <h3>
                        <span className="next-icon">
                          <Bell size={16} />
                        </span>{" "}
                        Próximo recordatorio
                      </h3>
                      <button
                        className="icon-button"
                        aria-label="Ver recordatorios"
                        onClick={() => navigate("Recordatorios")}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                    <span className="reminder-label">
                      T-30 DÍAS <span>Logística</span>
                    </span>
                    <h4>Que nada detenga la creatividad.</h4>
                    <p>
                      Confirmar acceso al venue 24/7 y conexión de red de al
                      menos 20 Mbps.
                    </p>
                    <div className="between">
                      <span className="reminder-date">
                        <CalendarDays size={14} />{" "}
                        {jamDate(taskDate(event.start, -30), {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <button
                        className="round-arrow"
                        aria-label="Configurar recordatorio"
                        onClick={() => navigate("Recordatorios")}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
          {(page === "Resumen" || page === "Tareas") && (
            <section className="panel tasks-panel">
              <div className="section-heading">
                <div>
                  <h3>
                    {page === "Resumen"
                      ? "Tareas de la fase actual"
                      : "Checklist operativo"}
                    <span className="count-chip">
                      {page === "Resumen"
                        ? tasks.filter((t) => t.phase === activePhase).length
                        : tasks.length}
                    </span>
                  </h3>
                  <p>
                    {page === "Resumen"
                      ? "Pequeños pasos que hacen grandes eventos."
                      : "31 tareas históricas para que nada se quede atrás."}
                  </p>
                </div>
                <div className="heading-actions">
                  {page === "Resumen" && (
                    <button
                      className="text-button"
                      onClick={() => navigate("Tareas")}
                    >
                      Ver todas las tareas <ArrowUpRight size={14} />
                    </button>
                  )}
                  <button
                    className="button primary"
                    onClick={() => setModal("task")}
                  >
                    <Plus size={16} /> Nueva tarea
                  </button>
                </div>
              </div>
              <div className="table-toolbar">
                <div className="view-tabs">
                  {[
                    [ListTodo, "Tabla"],
                    [LayoutGrid, "Kanban"],
                    [ChartNoAxesGantt, "Cronograma"],
                  ].map(([Icon, label]) => (
                    <button
                      key={String(label)}
                      className={view === label ? "selected" : ""}
                      onClick={() => setView(String(label))}
                    >
                      {React.createElement(Icon as typeof Bell, { size: 15 })}
                      {String(label)}
                    </button>
                  ))}
                </div>
                <div className="table-filters">
                  <div className="search-field">
                    <Search size={15} />
                    <input
                      placeholder="Buscar tarea..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="Todos">Todos los miembros</option>
                    {members.map((m) => (
                      <option key={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {view === "Tabla" ? (
                <TaskTable
                  members={members}
                  eventStart={event.start}
                  eventEnd={local ? event.end : undefined}
                  planningStart={local ? event.planningStart : undefined}
                  onUpdate={updateTask}
                  onEdit={(id) => setModal(`edit:${id}`)}
                  items={
                    page === "Resumen"
                      ? filtered.filter((t) => t.phase === activePhase)
                      : filtered
                  }
                />
              ) : view === "Kanban" ? (
                <div className="kanban">
                  {["Pendiente", "En progreso", "Completada"].map((status) => (
                    <div key={status}>
                      <h4>
                        <i
                          className={status === "Completada" ? "green-dot" : ""}
                        />
                        {status}
                        <span>
                          {filtered.filter((t) => t.status === status).length}
                        </span>
                      </h4>
                      {filtered
                        .filter((t) => t.status === status)
                        .map((t) => (
                          <article key={t.id}>
                            <span className={`priority p${t.priority}`}>
                              <i />
                              {priorities[t.priority]}
                            </span>
                            <h4>{t.title}</h4>
                            <div className="between">
                              <Avatar name={t.owner} small />
                              <select
                                value={t.status}
                                onChange={(e) =>
                                  updateTask(t.id, e.target.value)
                                }
                              >
                                {["Pendiente", "En progreso", "Completada"].map(
                                  (s) => (
                                    <option key={s}>{s}</option>
                                  ),
                                )}
                              </select>
                            </div>
                          </article>
                        ))}
                    </div>
                  ))}
                </div>
              ) : local ? (
                <Timeline
                  tasks={filtered}
                  event={event}
                  onUpdate={updateTask}
                />
              ) : (
                <div className="gantt">
                  <div className="gantt-scale">
                    <span>Fase</span>
                    {["T-60", "T-30", "T-14", "T-7", "Jam", "Post"].map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  {phases.map((p, i) => (
                    <div className="gantt-row" key={p}>
                      <strong>{p.split(" · ")[0]}</strong>
                      <div>
                        <span
                          style={{ left: `${i * 16.66}%`, width: "16.66%" }}
                        >
                          {filtered.filter((t) => t.phase === i).length} tareas
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {page === "Resumen" && (
            <div className="bottom-note">
              <span>
                <Gamepad2 size={15} /> Creado para quienes hacen posibles los
                juegos.
              </span>
              <span>Un poco de orden. Mucha creatividad. ✦</span>
            </div>
          )}
          {page === "Comité organizador" && (
            <>
              <div className="section-heading">
                <span>{members.length} personas · 12 roles de campo</span>
                <button
                  className="button primary"
                  onClick={() => setModal("member")}
                >
                  <Plus size={16} />
                  Agregar miembro
                </button>
              </div>
              <div className="member-grid">
                {members.map((m) => (
                  <article className="panel member-card" key={m.email}>
                    <Avatar name={m.name} color={m.color} />
                    <h3>{m.name}</h3>
                    <p>{m.email}</p>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setMembers(
                          members.map((x) =>
                            x.email === m.email
                              ? { ...x, role: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <div className="between">
                      <span>
                        {tasks.filter((t) => t.owner === m.name).length} tareas
                        asignadas
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          navigate("Tareas");
                          setFilter(m.name);
                        }}
                      >
                        Ver tareas <ArrowRight size={14} />
                      </button>
                    </div>
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (tasks.some((t) => t.owner === m.name)) {
                          notify(
                            "Reasigna sus tareas antes de eliminar al miembro.",
                          );
                          return;
                        }
                        setMembers(members.filter((x) => x.email !== m.email));
                      }}
                    >
                      Eliminar miembro
                    </button>
                  </article>
                ))}
              </div>
              <section className="panel roles-panel">
                <h3>Roles de campo</h3>
                <div className="role-list">
                  {roles.map((r, i) => (
                    <div key={r}>
                      <span>
                        {
                          [
                            "👑",
                            "📍",
                            "📣",
                            "🎨",
                            "📡",
                            "🤝",
                            "🚪",
                            "🎁",
                            "🎤",
                            "📸",
                            "🎮",
                            "💡",
                          ][i]
                        }
                      </span>
                      <strong>{r}</strong>
                      <small>
                        {members.find((m) => m.role === r)?.name ||
                          "Por asignar"}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {page === "Evaluación y premios" && (
            <>
              <div className="section-heading">
                <div>
                  <h3>Estudio de evaluación</h3>
                  <p>Rúbrica GGJ2026 · 100 puntos generales + 20 extra</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (local) {
                        navigate("Accesos del jurado");
                      } else if (cloud) {
                        notify(
                          "Agrega jueces por correo desde Accesos del evento",
                        );
                      } else setModal("judge");
                    }}
                  >
                    <Plus size={16} />
                    Juez
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal("team")}
                  >
                    <Plus size={16} />
                    Equipo
                  </button>
                </div>
              </div>
              {cloud && !cloud.canEvaluate && (
                <p className="info-note">
                  Puedes consultar el ranking. Para evaluar, tu correo debe
                  tener acceso de Juez en este evento.
                </p>
              )}
              <div className="evaluation-grid">
                <section className="panel rubric">
                  <div className="form-grid">
                    <label>
                      Juez
                      <select
                        aria-label="Juez"
                        value={judge}
                        disabled={!!cloud}
                        onChange={(e) => setJudge(e.target.value)}
                      >
                        {(cloud ? [cloud.actor] : judges).map((j) => (
                          <option key={j}>{j}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Equipo
                      <select
                        aria-label="Equipo"
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                      >
                        {teams.map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.code} · {t.name} · {t.time}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {[
                    "Originalidad",
                    "Diseño de juego",
                    "Interacciones",
                    "Calidad artística",
                    "Calidad técnica",
                    "Innovación",
                    "Viabilidad",
                    "Diversificadores",
                  ].map((name, i) => {
                    const ranges = [
                      [0, 2],
                      [2, 6],
                      [6, 9],
                      [9, 13],
                      [13, 15],
                      [15, 17],
                      [17, 20],
                      [20, 21],
                    ];
                    return (
                      <div className="criteria-group" key={name}>
                        <h4>
                          {name}
                          <span>
                            {i < 5
                              ? "20 pts"
                              : i === 5
                                ? "10 pts"
                                : i === 6
                                  ? "6 pts"
                                  : "4 pts"}
                          </span>
                        </h4>
                        {criteria
                          .slice(...(ranges[i] as [number, number]))
                          .map(([label, max], j) => {
                            const idx = ranges[i][0] + j;
                            return (
                              <label className="score-row" key={label}>
                                <span>{label}</span>
                                <input
                                  aria-label={label}
                                  type="number"
                                  min={0}
                                  max={max}
                                  value={scores[idx]}
                                  onChange={(e) =>
                                    setScores(
                                      scores.map((s, k) =>
                                        k === idx
                                          ? Math.min(
                                              max,
                                              Math.max(
                                                0,
                                                Number(e.target.value),
                                              ),
                                            )
                                          : s,
                                      ),
                                    )
                                  }
                                />
                                <small>/ {max}</small>
                              </label>
                            );
                          })}
                      </div>
                    );
                  })}
                  {local &&
                    (
                      local.data["gj-auth-judges"] as string[] | undefined
                    )?.includes(judge) && (
                      <p className="info-note">
                        Este juez tiene una cuenta propia. Sus evaluaciones se
                        capturan desde su acceso del jurado.
                      </p>
                    )}
                  <div className="between">
                    <strong>
                      Total: {scores.reduce((a, b) => a + b, 0)} / 120
                    </strong>
                    <button
                      className="button primary"
                      disabled={
                        !judge ||
                        !teams.length ||
                        !!(
                          local?.data["gj-auth-judges"] as string[] | undefined
                        )?.includes(judge) ||
                        (!!cloud && !cloud.canEvaluate)
                      }
                      onClick={() => {
                        setEvaluations({
                          ...evaluations,
                          [`${judge}:${team}`]: scores,
                        });
                        notify(
                          cloud
                            ? "Evaluación en cola; comprueba el indicador de sincronización"
                            : "Evaluación guardada",
                        );
                      }}
                    >
                      Guardar evaluación
                    </button>
                  </div>
                </section>
                <section className="panel leaderboard">
                  <div className="section-heading">
                    <h3>
                      <Trophy size={19} /> Tabla de posiciones
                    </h3>
                  </div>
                  <label>
                    Ponderación del jurado: {weight}%
                    <input
                      type="range"
                      disabled={!!cloud && !cloud.organizer}
                      min="0"
                      max="100"
                      value={weight}
                      onChange={(e) => setWeight(+e.target.value)}
                    />
                  </label>
                  <p className="muted">
                    Público: {100 - weight}% · Puntaje normalizado a 120
                  </p>
                  {leaderboard.map((t, i) => (
                    <div className="leader-item" key={t.code}>
                      <span className="medal">
                        {["🥇", "🥈", "🥉"][i] || `#${i + 1}`}
                      </span>
                      <div>
                        <h4>{t.name}</h4>
                        <small>
                          {t.game} · {t.count} evaluaciones
                        </small>
                        <p>
                          {t.count
                            ? `${
                                local
                                  ? prizes
                                      .filter(
                                        (p) =>
                                          p.place === i + 1 &&
                                          p.status !== "Propuesto",
                                      )
                                      .map((p) => p.name)
                                      .join(" · ") || "Premio por confirmar"
                                  : "Premio"
                              }: ${i < 3 ? ["Primer", "Segundo", "Tercer"][i] + " lugar" : "Participación"}${event.vip && event.framework && i < 3 ? " · Pase VIP / booth en " + event.frameworkName : ""}`
                            : "Pendiente de evaluación"}
                        </p>
                        <label>
                          Votos del público
                          <input
                            type="number"
                            min="0"
                            value={t.votes}
                            disabled={!!cloud && !cloud.organizer}
                            onChange={(e) =>
                              setTeams(
                                teams.map((x) =>
                                  x.code === t.code
                                    ? {
                                        ...x,
                                        votes: Math.max(0, +e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      <strong>
                        {t.total.toFixed(1)}
                        <small>/120</small>
                      </strong>
                    </div>
                  ))}
                  <p className="info-note">
                    Los resultados son provisionales hasta que todos los jueces
                    evalúen. Un voto se registra manualmente; no hay votación
                    pública autenticada.
                  </p>
                </section>
              </div>
            </>
          )}
          {local && page === "Premios" && <PrizeBudget />}
          {local && page === "Accesos del jurado" && <JudgeAccess />}
          {local && page === "Recordatorios" && <OperationalReminders />}
          {page === "Recordatorios" && !local && (
            <section className="panel settings-panel">
              <div className="section-heading">
                <div>
                  <h3>Que ningún momento se te escape</h3>
                  <p>Recordatorios por rol, relativos al inicio del evento.</p>
                </div>
                <button
                  className="button primary"
                  onClick={async () => {
                    if (!("Notification" in window)) {
                      notify("Este navegador no admite notificaciones");
                      return;
                    }
                    const permission = await Notification.requestPermission();
                    notify(
                      permission === "granted"
                        ? "Notificaciones habilitadas"
                        : "Permiso de notificaciones no concedido",
                    );
                  }}
                >
                  <Bell size={16} />
                  Activar notificaciones
                </button>
              </div>
              {reminders.map((r, i) => (
                <div className="reminder-row" key={i}>
                  <span className="stat-icon purple">
                    <Clock size={20} />
                  </span>
                  <div>
                    <small>
                      {r.day < 0 ? `T${r.day} días` : "Hora 46:00"} · {r.role}
                    </small>
                    <h4>{r.text}</h4>
                    <p>
                      {jamDate(taskDate(event.start, r.day), {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="subtle-chip">
                    {event.start ? "Programado" : "Sin fecha"}
                  </span>
                </div>
              ))}
              <PushControls notify={notify} />
              <p className="info-note">
                {cloud ? (
                  "En Netlify Free esta versión ofrece recordatorios con la aplicación abierta. El push programado con la app cerrada no está conectado a Supabase; no se ha activado ningún servicio de pago."
                ) : (
                  <>
                    Los avisos locales se comprueban con la app abierta. Activa
                    Web Push para recibirlos con la app cerrada: el servidor
                    debe permanecer activo y accesible por HTTPS. Las claves
                    VAPID se generan de forma segura al arrancar; las entregas
                    dependen del navegador y su servicio push.
                  </>
                )}
              </p>
              <button
                className="button secondary"
                onClick={async () => {
                  if (
                    !("Notification" in window) ||
                    Notification.permission !== "granted"
                  ) {
                    notify("Activa primero las notificaciones");
                    return;
                  }
                  const reg = await navigator.serviceWorker.ready;
                  await reg.showNotification("Game Jam Manager", {
                    body: "¡Todo listo para tu próximo gran jam!",
                    icon: "/icon.svg",
                  });
                }}
              >
                Enviar aviso de prueba
              </button>
            </section>
          )}
          {page === "Participantes" && (cloud?.organizer || local) && (
            <>
              {local && <RegistrationSettings />}
              <Participants />
            </>
          )}
          {page === "Configuración" && (
            <section className="panel settings-panel">
              <h3>Tu espacio de organización</h3>
              <div className="settings-row">
                <div>
                  <h4>Datos del anfitrión y sede</h4>
                  <p>
                    {host.name} · {host.organization}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setModal("host")}
                >
                  Editar anfitrión
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <h4>Evento actual</h4>
                  <p>
                    {event.name} · {event.mode}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    if (!cloud || cloud.organizer) setModal("event");
                  }}
                >
                  Editar evento
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <h4>Base maestra de anfitriones</h4>
                  <p>
                    {masters.length} registros guardados en este dispositivo.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        JSON.stringify(
                          {
                            hosts: masters,
                            event,
                            members,
                            tasks,
                            teams,
                            judges,
                            evaluations,
                            weight,
                            participants:
                              cloud?.snapshot.data["gj-participants"] ||
                              local?.data["gj-participants"] ||
                              [],
                            prizes,
                            reminders: local?.data["gj-reminders"] || [],
                            answers: local?.jam.answers,
                            edition: local?.jam.edition,
                            access: cloud?.members || [],
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "game-jam-backup.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={16} />
                  Exportar respaldo
                </button>
              </div>
              {masters.map((m, i) => (
                <div className="settings-row" key={i}>
                  <div>
                    <h4>{m.name}</h4>
                    <p>
                      {m.organization} · {m.venue}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setHost(m);
                      notify("Anfitrión restaurado");
                    }}
                  >
                    Usar en esta edición
                  </button>
                </div>
              ))}
              <p className="info-note">
                {cloud
                  ? "Datos compartidos mediante Supabase con permisos por evento. Los cambios offline quedan en cola por usuario y evento. Revisa el estado de sincronización antes de cerrar sesión."
                  : STATIC_MODE
                    ? "Modo estático: los datos se guardan solo en este navegador, sin sincronización entre dispositivos. Exporta un respaldo antes de borrar los datos del sitio."
                    : "Datos locales con sincronización automática a SQLite cuando el servidor está disponible. Los cambios offline se envían al reconectar. Exporta un respaldo para conservar tus datos."}
              </p>
            </section>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Dialog onClose={() => setModal("")}>
          <div className="section-heading">
            <h3>
              {modal === "event"
                ? "Detalles del evento"
                : modal === "host"
                  ? "Anfitrión y sede"
                  : modal === "member"
                    ? "Nuevo miembro"
                    : modal === "judge"
                      ? "Registrar juez"
                      : modal === "team"
                        ? "Registrar equipo"
                        : modal.startsWith("edit:")
                          ? "Editar tarea"
                          : "Nueva tarea"}
            </h3>
            <button
              className="icon-button"
              aria-label="Cerrar"
              onClick={() => setModal("")}
            >
              <X size={20} />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (cloud && !cloud.organizer) {
                notify("Solo los organizadores pueden editar estos datos");
                return;
              }
              const f = new FormData(e.currentTarget);
              const s = (k: string) => String(f.get(k) || "").trim();
              if (modal === "event") {
                if (new Date(s("end")) <= new Date(s("start"))) {
                  notify("La fecha de fin debe ser posterior al inicio");
                  return;
                }
                setEvent({
                  ...event,
                  ...(local
                    ? {
                        edition: s("edition"),
                        platform: s("platform"),
                        planningStart: new Date(
                          s("planningStart"),
                        ).toISOString(),
                      }
                    : {}),
                  name: s("name"),
                  start: new Date(s("start")).toISOString(),
                  end: new Date(s("end")).toISOString(),
                  mode: s("mode"),
                  venue: s("venue"),
                  framework: s("framework") === "Sí",
                  frameworkName: s("frameworkName"),
                  vip: f.get("vip") === "on",
                });
              } else if (modal === "host") {
                const h = {
                  name: s("name"),
                  email: s("email"),
                  organization: s("organization"),
                  venue: s("venue"),
                  sponsors: s("sponsors"),
                };
                setHost(h);
                setMasters([...masters.filter((m) => m.email !== h.email), h]);
              } else if (modal === "member") {
                if (
                  members.some(
                    (m) => m.email === s("email") || m.name === s("name"),
                  )
                ) {
                  notify("Ya existe este miembro");
                  return;
                }
                setMembers([
                  ...members,
                  {
                    name: s("name"),
                    email: s("email"),
                    role: s("role"),
                    color: ["purple", "blue", "pink", "orange"][
                      members.length % 4
                    ],
                  },
                ]);
              } else if (modal === "judge") {
                if (judges.includes(s("name"))) {
                  notify("Este juez ya está registrado");
                  return;
                }
                setJudges([...judges, s("name")]);
                setJudge(s("name"));
              } else if (modal === "team") {
                if (teams.some((t) => t.code === s("code"))) {
                  notify("Este código de equipo ya existe");
                  return;
                }
                setTeams([
                  ...teams,
                  {
                    code: s("code"),
                    name: s("name"),
                    game: s("game"),
                    time: s("time"),
                    votes: 0,
                  },
                ]);
              } else {
                const old = tasks.find((t) => `edit:${t.id}` === modal);
                const t = {
                  id: old?.id ?? Date.now(),
                  title: s("title"),
                  phase: +s("phase"),
                  priority: +s("priority"),
                  owner: s("owner"),
                  status: old?.status || "Pendiente",
                  day: [-60, -30, -14, -7, 0, 3][+s("phase")],
                };
                setTasks(
                  old
                    ? tasks.map((x) => (x.id === old.id ? t : x))
                    : [...tasks, t],
                );
              }
              setModal("");
              notify(
                cloud
                  ? "Cambios en cola para sincronización"
                  : "Cambios guardados en este dispositivo",
              );
            }}
          >
            {modal === "event" ? (
              <>
                <label>
                  Nombre del evento
                  <input name="name" required defaultValue={event.name} />
                </label>
                {local && (
                  <>
                    <label>
                      Edición
                      <input
                        name="edition"
                        maxLength={60}
                        defaultValue={local.jam.edition}
                      />
                    </label>
                    <label>
                      Inicio de planeación
                      <input
                        type="datetime-local"
                        name="planningStart"
                        required
                        defaultValue={inputDate(
                          event.planningStart ||
                            local.jam.createdAt ||
                            event.start,
                        )}
                      />
                    </label>
                    <label>
                      Plataforma virtual
                      <input name="platform" defaultValue={event.platform} />
                    </label>
                  </>
                )}
                <div className="form-grid">
                  <label>
                    Inicio
                    <input
                      type="datetime-local"
                      name="start"
                      required
                      defaultValue={inputDate(event.start)}
                    />
                  </label>
                  <label>
                    Fin
                    <input
                      type="datetime-local"
                      name="end"
                      required
                      defaultValue={inputDate(event.end)}
                    />
                  </label>
                </div>
                <label>
                  Modalidad
                  <select name="mode" defaultValue={event.mode}>
                    {["Presencial", "Virtual", "Híbrido"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sede
                  <input name="venue" required defaultValue={event.venue} />
                </label>
                <label>
                  ¿En el marco de un congreso o festival?
                  <select
                    name="framework"
                    defaultValue={event.framework ? "Sí" : "No"}
                  >
                    <option>Sí</option>
                    <option>No</option>
                  </select>
                </label>
                <label>
                  Nombre del evento marco
                  <input
                    name="frameworkName"
                    defaultValue={event.frameworkName}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="vip"
                    defaultChecked={event.vip}
                  />{" "}
                  Entregar pases VIP / booths como premio
                </label>
              </>
            ) : modal === "host" ? (
              <>
                {[
                  ["name", "Nombre completo"],
                  ["email", "Correo"],
                  ["organization", "Organización / Colectivo"],
                  ["venue", "Sede habitual"],
                  ["sponsors", "Patrocinadores objetivo"],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      name={k}
                      type={k === "email" ? "email" : "text"}
                      required
                      defaultValue={host[k as keyof typeof host]}
                    />
                  </label>
                ))}
              </>
            ) : modal === "member" ? (
              <>
                <label>
                  Nombre completo
                  <input required name="name" />
                </label>
                <label>
                  Correo
                  <input required type="email" name="email" />
                </label>
                <label>
                  Rol
                  <select name="role">
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : modal === "judge" ? (
              <label>
                Nombre completo
                <input required name="name" />
              </label>
            ) : modal === "team" ? (
              <>
                {[
                  ["code", "Código"],
                  ["name", "Nombre del equipo"],
                  ["game", "Nombre del juego"],
                  ["time", "Hora de presentación"],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      required
                      type={k === "time" ? "time" : "text"}
                      name={k}
                    />
                  </label>
                ))}
              </>
            ) : (
              <>
                <label>
                  Nombre de la tarea
                  <input
                    required
                    name="title"
                    defaultValue={
                      tasks.find((t) => `edit:${t.id}` === modal)?.title
                    }
                  />
                </label>
                <label>
                  Fase
                  <select
                    name="phase"
                    defaultValue={
                      tasks.find((t) => `edit:${t.id}` === modal)?.phase ?? 0
                    }
                  >
                    {phases.map((p, i) => (
                      <option value={i} key={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prioridad
                  <select
                    name="priority"
                    defaultValue={
                      tasks.find((t) => `edit:${t.id}` === modal)?.priority ?? 2
                    }
                  >
                    {priorities.map((p, i) => (
                      <option value={i} key={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Responsable
                  <select
                    name="owner"
                    defaultValue={
                      tasks.find((t) => `edit:${t.id}` === modal)?.owner
                    }
                  >
                    {members.map((m) => (
                      <option key={m.name}>{m.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="modal-actions">
              {modal.startsWith("edit:") && (
                <button
                  type="button"
                  className="text-button danger"
                  style={{ marginRight: "auto" }}
                  onClick={() => {
                    setTasks(tasks.filter((t) => `edit:${t.id}` !== modal));
                    setModal("");
                    notify("Tarea eliminada");
                  }}
                >
                  Eliminar tarea
                </button>
              )}
              <button
                className="button secondary"
                type="button"
                onClick={() => setModal("")}
              >
                Cancelar
              </button>
              <button className="button primary" type="submit">
                Guardar cambios <Check size={15} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <CloudRoot>
    <LocalRoot>
      <App />
    </LocalRoot>
  </CloudRoot>,
);
