# Game Jam Manager

PWA en español para coordinar hasta seis eventos, sus comités, participantes y jueces. React 19 + TypeScript + Tailwind CSS 4 + Vite. **El despliegue recomendado es Netlify Free + Supabase Free** con PostgreSQL, autenticación y permisos por evento.

## Publicar y conectar

Sigue [DEPLOY_SUPABASE.md](DEPLOY_SUPABASE.md). Incluye instrucciones desde cero para crear ambos proyectos, ejecutar la migración SQL, configurar la URL/clave pública y publicar la carpeta compilada sin instalar Node. También explica la configuración del correo, las cuentas de jueces y la prueba final en dos navegadores.

El código está publicado en `danielopzs/GameJamHub`, rama `main`, con la configuración de build de Netlify incluida. La conexión real a Supabase y la publicación de la PWA requieren configurar el proyecto, el sitio y los accesos correspondientes; no se deben confundir con las pruebas locales.

## Desarrollo

Node.js 22.13+ (recomendado 24):

```sh
npm ci
# Copia .env.example a .env.local y configura solo las dos variables públicas de Supabase.
npm run dev:cloud
```

```sh
npm run build:cloud  # PWA conectada para Netlify; salida en dist/
npm run preview      # Servir el bundle compilado localmente
npm run build:static # Demo exclusivamente local, sin consultas a Supabase
```

En el build cloud, la configuración viene de `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY`). Para subidas manuales, completa `dist/config.js` después de compilar; sus valores son públicos. No uses claves `secret` ni `service_role`, ni la contraseña de PostgreSQL.

Sin configuración, el build cloud muestra una pantalla de activación y un botón explícito para explorar la demo local. Nunca presenta esa demo como una conexión real.

## Funciones

- Seis eventos independientes por anfitrión y perfiles de anfitrión/sede reutilizables al crear otra edición.
- Autenticación Supabase: acceso por correo/contraseña, registro y recuperación (estos últimos requieren envío de correo configurado).
- Accesos por evento: hasta 10 organizadores y 5 jueces; los participantes no necesitan crear cuentas.
- Comité operativo de hasta 10 personas con 12 roles de campo.
- 31 tareas iniciales en seis fases, tabla, kanban, cronograma, responsables, búsqueda y filtros. La matriz se infirió de los requisitos; no se recibió un archivo histórico de origen.
- Registro de hasta 100 participantes con equipo y control de entrada.
- Equipos, hora de presentación y evaluación de 21 criterios hasta 120 puntos.
- Evaluaciones independientes por juez autenticado; promedio y ponderación calculados en PostgreSQL, 85% jurado / 15% público inicialmente.
- Publicación provisional del podio y premios/pases del evento marco. Los votos públicos se introducen manualmente.
- Modo claro/oscuro, diseño móvil, diálogos con Escape y control de foco.
- PWA instalable, caché offline, borradores pendientes aislados por usuario/evento, respaldo JSON y conflictos de edición visibles.

## Pruebas

```sh
npm test        # Servidor SQLite opcional y planificación local
npm run test:ui # Chromium: acceso, eventos, participantes, jueceo y conflictos
npm run test:db # PostgreSQL 17 desechable vía Docker: migración, RLS, límites y ranking
```

Para `test:ui`, instala Chromium (`npx playwright install chromium`) si tu sistema no incluye `/usr/bin/chromium`. Las pruebas UI interceptan los servicios Supabase con respuestas controladas; no crean cuentas ni datos remotos. `test:db` utiliza PostgreSQL real, roles `authenticated`/`anon` y un stub local de `auth.uid()`/`auth.jwt()`; **nunca ejecutes el bootstrap de pruebas contra Supabase real**. La prueba de conexión remota sigue pendiente de crear tus servicios.

## Estructura

- `src/main.tsx`: pantallas de organización y evaluación.
- `src/cloud/client.ts`: configuración segura del cliente Supabase.
- `src/cloud/CloudRoot.tsx`: autenticación, eventos y accesos.
- `src/cloud/store.tsx`: sincronización, borradores, revisión y ranking compartido.
- `src/cloud/Participants.tsx`: registro y entrada de participantes.
- `src/data.ts`: roles, tareas y rúbrica.
- `supabase/migrations/001_gamejam.sql`: tablas, RLS y funciones RPC.
- `supabase/tests/`: pruebas desechables de permisos y cálculos.
- `public/config.js`: configuración pública para despliegue manual.
- `public/sw.js`, `manifest.webmanifest`: instalación, caché y recepción push.
- `netlify.toml`: build cloud y publicación estática.

## Variante local anterior

Se conserva el servidor Node/SQLite para uso local o alojamiento propio: `npm run dev` arranca Vite y la API; `npm run build && npm start` sirve frontend y API. Ese servidor genera claves VAPID en `.data/` y puede entregar push si permanece activo y tiene suscriptores. No se despliega ni se necesita en Netlify/Supabase Free. El `Dockerfile` corresponde a esta variante, exige `APP_PASSWORD` en producción y necesita un volumen persistente.

En la versión Supabase/Netlify, solo están activos los recordatorios con la app abierta. No se ha conectado un planificador push remoto ni contratado ningún servicio de pago. Consulta la guía para límites de los planes gratuitos y respaldo de datos.
