# Game Jam Manager: guía completa de conexión y publicación

Esta guía corresponde al código de **danielopzs/GameJamHub**, rama **main**. Puedes hacer todo el despliegue principal con tu navegador. No necesitas instalar Node, usar una terminal, contratar un servidor ni proporcionar tokens administrativos a Codex.

**Objetivo:** publicar una PWA con datos compartidos para seis eventos, hasta 10 accesos de organización y 5 jueces por evento, comité operativo y hasta 100 participantes por evento.

**Estado comprobado desde Codex:** el código está en GitHub. El acceso administrativo disponible aquí a Supabase y Netlify responde `401`; los valores públicos recibidos tampoco pasan la validación de formato. Hay un borrador de entorno sin publicar. Eso impide administrar las plataformas desde este chat, pero no impide conectarlas desde sus paneles. No se ha confirmado un despliegue remoto funcional.

Las etiquetas de los paneles pueden variar. Si una opción no aparece exactamente con el nombre indicado, busca la sección equivalente. No elimines recursos existentes para recrearlos: primero identifica qué ya tienes.

## Mapa de lo que vas a conectar

```text
GitHub: guarda el código
   │
   └── Netlify: compila main y publica la PWA con HTTPS
                    │
                    └── Supabase: acceso de usuarios + PostgreSQL + permisos
```

La vinculación de tu cuenta GitHub con un proveedor no crea necesariamente el proyecto de aplicación ni conecta su base de datos. Esta guía completa esas conexiones.

Necesitas tres pestañas abiertas:

1. https://github.com/danielopzs/GameJamHub
2. https://supabase.com/dashboard
3. https://app.netlify.com

Para probar con un organizador y un juez, usa dos navegadores diferentes, o una ventana normal y otra de incógnito. Dos pestañas de una misma sesión suelen compartir la cuenta y no sirven para esa comprobación.

## 1. Comprueba el repositorio GitHub

1. Abre el repositorio del primer enlace e inicia sesión si es privado.
2. Selecciona la pestaña **Code**.
3. En el selector de rama, elige **main**.
4. Comprueba que ves estos elementos:

   - `package.json`
   - `netlify.toml`
   - `src/`
   - `public/`
   - `supabase/migrations/001_gamejam.sql`

5. No subas el ZIP compilado sobre estos archivos. Esta ruta utiliza el código fuente y Netlify lo compila.

**Resultado esperado:** los archivos están visibles en `main`. Si ves un repositorio vacío, comprueba que abriste `danielopzs/GameJamHub` y la cuenta GitHub que tiene acceso.

## 2. Crea o localiza UN proyecto Supabase

1. Abre Supabase Dashboard.
2. Si ya aparece un proyecto destinado a Game Jam Manager, ábrelo; no crees otro por defecto.
3. Si no existe, pulsa **New project**.
4. Selecciona una organización con plan **Free**. Si no tienes organización, crea una y elige Free.
5. Como nombre de proyecto puedes usar **GameJamHub**.
6. Genera una contraseña fuerte para la base de datos y guárdala en tu gestor de contraseñas. Esa contraseña no se pone en GitHub, Netlify, la PWA ni el chat.
7. Elige una región cercana a la mayoría de tus usuarios. Para Monterrey, una región disponible en Estados Unidos puede ser una opción razonable; elige entre las que el panel ofrezca.
8. Crea el proyecto y espera a que esté operativo. Si aparece pausado, utiliza la opción de reanudarlo y espera a que esté disponible.

**Resultado esperado:** dentro del proyecto ves secciones como Table Editor, SQL Editor, Authentication y Project Settings.

Un solo proyecto Supabase aloja los seis eventos. No necesitas seis proyectos o seis organizaciones. Comprueba en los paneles las cuotas vigentes del plan Free y no aceptes una actualización de pago para seguir esta guía.

## 3. Identifica correctamente los datos de conexión

Dentro de ESE proyecto, busca **Connect**, **Project Settings → Data API** o **Project Settings → API Keys**. La ubicación puede variar con la versión del panel.

Copia estos dos valores a una nota privada temporal:

| Dato | Ejemplo ilustrativo | Para qué sirve |
|---|---|---|
| Project URL | `https://abcdefghijklmnopqrst.supabase.co` | Dirección de la API de TU proyecto |
| Publishable key | `sb_publishable_...` | Clave pública que utilizará la PWA |

Los valores del ejemplo no funcionan: debes usar los que muestra tu proyecto.

No confundas la Project URL con:

- La dirección del Dashboard, como `https://supabase.com/dashboard/project/...`.
- La dirección de Netlify.
- Una conexión PostgreSQL que empieza con `postgresql://`.
- Solo el identificador del proyecto, sin `https://` y sin `.supabase.co`.

Si tu proyecto solo muestra las claves antiguas, puedes usar la clave **anon** con la variable alternativa indicada en el paso 6. No uses una clave **service_role**, una clave **secret**, un token de cuenta `sbp_...` ni la contraseña de PostgreSQL como clave pública.

**Resultado esperado:** tienes una URL HTTPS de proyecto y una clave publishable (o una anon antigua). No necesitas crear tokens administrativos para esta ruta de publicación.

## 4. Crea la estructura de PostgreSQL

### 4.1 Comprueba si ya se creó

1. En Supabase abre **Table Editor**.
2. Selecciona el esquema **public** si existe ese selector.
3. Busca estas cuatro tablas:

   - `jam_events`
   - `jam_members`
   - `jam_state`
   - `jam_evaluations`

Si NO existe ninguna, continúa en 4.2.

Si ya existen las cuatro, no ejecutes otra vez la creación: pasa a 4.3 para revisarlas.

Si solo existe una parte, detente antes de borrar o recrear. Copia el mensaje de error o el resultado de las comprobaciones y consúltalo; puede haber datos previos que deban conservarse.

### 4.2 Ejecuta el archivo correcto una sola vez

1. Abre este archivo en GitHub:

   https://github.com/danielopzs/GameJamHub/blob/main/supabase/migrations/001_gamejam.sql

2. Pulsa **Raw** para ver solo el SQL. Según la interfaz puede estar junto a los iconos de copiar o descargar.
3. Copia todo el contenido del archivo, desde el comentario inicial hasta la instrucción final `notify pgrst, 'reload schema';`.
4. Regresa al proyecto Supabase.
5. Abre **SQL Editor → New query**.
6. Pega el SQL completo. No pegues el código dentro de comillas, JSON o un bloque con las marcas de Markdown.
7. Pulsa **Run**.
8. Espera el resultado. Es normal ver un mensaje equivalente a **Success. No rows returned**: el archivo crea estructuras, no carga participantes.

No ejecutes los archivos `supabase/tests/bootstrap.sql` o `supabase/tests/security.sql` en el proyecto real. Son únicamente para pruebas locales desechables.

Si aparece un error, conserva su texto completo. No lo resuelvas eliminando tablas o desactivando RLS.

### 4.3 Verifica las tablas, las revisiones y los permisos

Abre otra consulta en SQL Editor y ejecuta:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'jam_events', 'jam_members', 'jam_state', 'jam_evaluations'
  )
order by tablename;
```

**Resultado esperado:** cuatro filas y `rowsecurity = true` en las cuatro.

Después ejecuta:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jam_events', 'jam_state')
  and column_name = 'revision'
order by table_name;
```

**Resultado esperado:** una columna `revision` en cada una de esas dos tablas.

Por último ejecuta:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and left(routine_name, 4) = 'jam_'
order by routine_name;
```

**Resultado esperado:** las once funciones `jam_create_event`, `jam_is_judge`, `jam_is_member`, `jam_is_organizer`, `jam_ranking`, `jam_remove_member`, `jam_save_evaluation`, `jam_save_state`, `jam_score_total`, `jam_set_member` y `jam_valid_scores`.

Que las tablas estén vacías es correcto. Se llenarán desde la PWA.

## 5. Configura Authentication y crea las primeras cuentas

### 5.1 Activa el acceso por correo y contraseña

1. En Supabase abre **Authentication**.
2. Busca **Sign In / Providers**, **Providers** o la sección equivalente.
3. Abre el proveedor **Email**.
4. Comprueba que esté habilitado el acceso por correo y contraseña.
5. Mantén habilitada la confirmación de correo para los registros normales.

En este proyecto, la autorización por evento utiliza el correo de la cuenta. No desactives su verificación como solución a problemas de envío.

### 5.2 Para esta primera prueba, crea usuarios desde el panel

El envío de correo de prueba de Supabase puede tener restricciones de destinatarios y cuotas. Para no depender de SMTP ni contratar correo, crea las primeras cuentas desde el Dashboard:

1. Abre **Authentication → Users**.
2. Pulsa **Add user → Create new user** o la opción equivalente para crear un usuario directamente.
3. Introduce tu correo como anfitrión y una contraseña fuerte que puedas recuperar.
4. Utiliza la opción de confirmar automáticamente el correo, si aparece.
5. Guarda el usuario.
6. Abre su detalle y comprueba que el correo figure confirmado.
7. Repite la operación con una segunda dirección que utilizarás como juez.

Usa **Create new user** para este procedimiento. **Invite user** es un flujo distinto y puede depender del envío de correo.

Si el panel únicamente ofrece una invitación y no la creación directa, no marques como resuelto ese paso: revisa la opción disponible o consulta el texto de la pantalla. No introduzcas una clave administrativa en la PWA para crear usuarios.

Las contraseñas de cada cuenta no son la contraseña de la base de datos ni las claves API. Compártelas con su titular por un canal privado y pide que las cambie después desde **Mi cuenta**, dentro de la PWA.

**Resultado esperado:** dos usuarios confirmados en Authentication → Users. Todavía no verás sus nombres en `jam_members`: los accesos a cada evento se asignarán desde la aplicación.

## 6. Conecta Netlify al repositorio real

### 6.1 Si ya existe un proyecto Netlify

1. Abre https://app.netlify.com.
2. Selecciona el equipo correcto si perteneces a más de uno.
3. Entra al proyecto que crees que corresponde a Game Jam Manager.
4. Busca **Project configuration / Site configuration → Build & deploy → Continuous deployment** o la sección equivalente de repositorio y builds.
5. Comprueba que el repositorio sea **danielopzs/GameJamHub**.
6. Comprueba que la rama de producción sea **main**.
7. Si no hay repositorio conectado, usa **Link repository / Connect repository** y selecciona ese repositorio.

### 6.2 Si aún no existe un proyecto Netlify

1. En el Dashboard pulsa **Add new project / Add new site**.
2. Selecciona **Import an existing project**.
3. Elige **GitHub**.
4. Autoriza el acceso de Netlify al repositorio si GitHub lo solicita.
5. Si no aparece GameJamHub, busca la opción de configurar la integración GitHub y permite específicamente el acceso a **danielopzs/GameJamHub**.
6. Selecciona el repositorio.
7. Elige la rama **main**.

### 6.3 Revisa los ajustes de compilación

Tanto en un proyecto existente como en uno nuevo, los valores deben ser:

| Ajuste | Valor |
|---|---|
| Production branch | `main` |
| Base directory | Vacío; raíz del repositorio |
| Build command | `npm run build:cloud` |
| Publish directory | `dist` |
| Node version | `24` |
| Functions directory | No se necesita para este despliegue |

El archivo `netlify.toml` ya contiene la configuración de build y publicación. Si Netlify indica que lee esos valores del archivo, es correcto. No hace falta configurar `npm start` ni mantener un servidor Node activo.

Si el panel muestra un directorio de paquete independiente, utiliza la raíz del repositorio; no selecciones `src` o `supabase`.

### 6.4 Agrega las dos variables públicas EN NETLIFY

1. En el proyecto Netlify abre **Project configuration → Environment variables** o la sección equivalente.
2. Agrega una variable cuyo nombre exacto sea:

   ```text
   VITE_SUPABASE_URL
   ```

3. En su valor pega la Project URL obtenida en el paso 3. No escribas el nombre de la variable como valor.
4. Agrega la segunda variable:

   ```text
   VITE_SUPABASE_PUBLISHABLE_KEY
   ```

5. En su valor pega la clave pública publishable del MISMO proyecto Supabase.
6. Si hay selector de alcance, asegúrate de que estén disponibles durante **Builds**.
7. Si hay selector de contexto, incluye **Production**. Para la primera configuración puedes utilizar el mismo valor en todos los contextos, si el panel ofrece esa opción.
8. Guarda los cambios.

No agregues comillas alrededor de los valores en el formulario de Netlify. No agregues el prefijo `Bearer`, ni pegues la etiqueta completa `NOMBRE=valor` dentro de la casilla de valor.

Si solo tienes una clave antigua anon, usa `VITE_SUPABASE_ANON_KEY` en lugar de `VITE_SUPABASE_PUBLISHABLE_KEY`. No dejes a la vez una publishable incorrecta y una anon correcta: el código da prioridad a publishable.

Estas dos variables son configuración pública de la PWA. No pongas aquí tokens administrativos, claves secret/service_role, ni contraseñas PostgreSQL. Los permisos de la base ya están definidos mediante RLS y funciones del paso 4.

**Resultado esperado:** dos variables con nombres exactos y valores de tu proyecto. Configurarlas en Codex, GitHub o un archivo de tu computadora no las configura automáticamente en Netlify.

## 7. Compila y publica en Netlify

1. Si todavía estás en el formulario inicial, pulsa **Deploy**.
2. Si el proyecto ya existe, entra a **Deploys**.
3. Abre **Trigger deploy → Deploy site**, **Deploy project**, o la opción equivalente de nuevo despliegue de producción.
4. Si cambiaste variables y parece mantenerse una versión anterior, utiliza la opción **Clear cache and deploy** si está disponible.
5. Espera a que termine. Los estados esperables son una cola inicial, compilación y finalmente **Published**.
6. Si aparece **Failed**, abre el despliegue y sus **Deploy log / Build log**.

Un despliegue no está listo solo porque exista un proyecto Netlify. Debe haber un despliegue de producción publicado.

En el log, la ejecución debe corresponder a `npm run build:cloud` y terminar con la publicación de archivos de `dist`. Si el log dice que una clave pública no es válida, vuelve al paso 6.4: el build protege contra el uso accidental de claves administrativas en el frontend.

Cuando esté Published:

1. Abre **Project overview / Site overview**.
2. Copia la dirección HTTPS que Netlify muestra realmente.
3. Ábrela en una ventana nueva.
4. Guarda esa dirección; será la que compartirás con tu equipo.

**No supongas que la URL es `https://gamejammanager.netlify.app`.** Solo lo será si ese nombre está asignado al proyecto en tu cuenta. Un nombre automático terminado en `.netlify.app` también sirve y puede conservarse sin comprar un dominio.

Si quieres cambiarlo, utiliza **Domain management** o la opción de cambiar el nombre/subdominio del proyecto. Solo uses el nombre deseado después de que Netlify confirme su asignación.

**Resultado esperado en el navegador:** pantalla **“Bienvenido de nuevo.”** con campos de correo y contraseña.

Si aparece **“Tu próximo jam, conectado.”**, se publicó el código pero faltan valores de configuración válidos. Revisa las variables de Netlify y vuelve a generar el despliegue. No pruebes el flujo de base de datos mediante **Explorar demo local**: esa demo guarda datos únicamente en el dispositivo.

## 8. Registra la URL definitiva en Supabase

Ahora que conoces la dirección REAL del sitio:

1. Vuelve al mismo proyecto Supabase usado para las claves.
2. Abre **Authentication → URL Configuration**.
3. En **Site URL** pega la dirección HTTPS de Netlify.
4. En **Redirect URLs** agrega esa misma dirección y una entrada con `/**` al final.
5. Guarda los cambios.

Ejemplo ilustrativo, si Netlify asignara `https://mi-jam-ejemplo.netlify.app`:

```text
Site URL:
https://mi-jam-ejemplo.netlify.app

Redirect URLs:
https://mi-jam-ejemplo.netlify.app
https://mi-jam-ejemplo.netlify.app/**
```

Sustituye el ejemplo por TU dirección. Si cambias de subdominio, actualiza estas opciones.

Esto es importante para los enlaces de confirmación y recuperación de contraseña. El acceso por contraseña también requiere que el correo esté confirmado y que URL/clave pertenezcan al mismo proyecto.

## 9. Entra como anfitrión y crea un evento

1. Abre la URL publicada por Netlify.
2. Escribe el correo y la contraseña del usuario anfitrión que creaste en el paso 5.
3. Pulsa **Entrar a mi espacio**.
4. Debe aparecer la pantalla **“Seis eventos. Infinitas posibilidades.”**.
5. Pulsa **Crear evento**.
6. Para validar sin mezclar calificaciones ficticias con tus eventos reales, puedes usar un evento temporal llamado exactamente **Prueba de conexion**. Si ya llegaste al límite de seis eventos, no crees otro: consulta el apartado de comprobación/limpieza al final o prueba con datos reales de una edición existente.
7. Abre ese evento.
8. Comprueba que tienes las 31 tareas pendientes.
9. En **Editar evento**, configura nombre, fechas, modalidad, sede y evento marco.
10. En **Configuración → Editar anfitrión**, guarda tus datos reales y los de tu organización/sede.

Al guardar, mira el indicador superior. Puede mostrar primero cambios pendientes y luego sincronización. Espera a que desaparezcan los pendientes antes de cerrar sesión.

**Comprobación directa:** en Supabase Table Editor, `jam_events` debe contener el evento y `jam_state` sus colecciones. El usuario no necesita crear filas manualmente en esas tablas.

## 10. Autoriza a tu comité y a los jueces

Hay tres conceptos distintos:

| Registro | Dónde se gestiona | Qué permite |
|---|---|---|
| Cuenta de usuario | Supabase Authentication | Iniciar sesión |
| Acceso al evento | PWA → Accesos del evento | Organizar o evaluar ese evento |
| Rol operativo | PWA → Comité organizador | Asignar tareas de logística, arte, registro, etc. |

Crear una cuenta no da acceso automático a un evento ajeno. Agregar un nombre al comité tampoco concede acceso de usuario por sí solo.

### 10.1 Accesos

1. En la PWA, dentro del evento, pulsa **Accesos del evento** en la barra superior.
2. Escribe el nombre del juez de prueba.
3. Escribe exactamente el correo de su cuenta confirmada en Authentication.
4. Elige permiso **Juez**.
5. Pulsa **Dar acceso**.
6. Comprueba que aparece en la lista.
7. Para otras personas del comité, repite el procedimiento eligiendo **Organizador**.

El formulario da autorización al correo; no crea la cuenta ni envía un email. Crea primero la cuenta o asegúrate de que su titular complete un registro confirmado.

Límites de esta versión: 10 accesos de organización y 5 de jueceo por evento. Si el propietario también quiere evaluar, agrega su mismo correo como **Juez**. Conserva sus derechos de propietario y ocupa una de las cinco plazas.

### 10.2 Roles de campo y participantes

- En **Comité organizador**, agrega hasta 10 personas y sus roles operativos.
- En **Evaluación y premios → Equipo**, registra códigos únicos como `T01`, nombre, juego y hora de presentación.
- En **Participantes**, registra hasta 100 personas, asigna equipo y confirma su entrada.

Los participantes no necesitan crear cuentas para figurar en el registro.

## 11. Comprueba el jueceo entre dos cuentas

Haz esta prueba con el evento temporal y sus datos de prueba, no con calificaciones reales que deban preservarse.

1. Como organizador, registra un equipo de prueba con código **T01**, nombre y juego identificables como prueba.
2. En la ponderación del ranking, usa temporalmente **100% jurado** y espera a que se sincronice. Así la comprobación no depende de votos públicos.
3. Abre un segundo navegador o una ventana de incógnito.
4. Entra con la cuenta confirmada del juez.
5. Debe aparecer el evento autorizado. Si no aparece, verifica el correo exacto en Accesos del evento y pulsa **Actualizar mis accesos** o vuelve a entrar.
6. Abre el evento. El juez debe ver **Evaluación y premios**, no las pantallas de administración de participantes o tareas.
7. Comprueba que el selector de juez esté fijado a SU correo.
8. Selecciona **T01**.
9. Da **10** puntos a **Concepto** y deja los demás criterios en cero. El total de la evaluación debe ser **10 / 120**.
10. Pulsa **Guardar evaluación**.
11. Espera a que no haya cambios pendientes en el indicador superior.
12. En el navegador del organizador, vuelve a la pantalla de evaluación. Espera el refresco de datos en primer plano, que ocurre cada 30 segundos, o recarga después de que el juez haya sincronizado.
13. El equipo debe mostrar una evaluación y **10.0** puntos en el ranking con ponderación 100% jurado.
14. Para comprobar el promedio, crea/autoriza un segundo juez y repite con **6** puntos en Concepto: el promedio debe ser **8.0**.
15. En Supabase Table Editor, `jam_evaluations` debe mostrar una fila por juez y equipo. Actualizar la evaluación del mismo juez no debe crear una fila duplicada.

Para comprobar la fórmula predeterminada después, usa datos de prueba: con promedio de jurado 8, un equipo con el máximo de votos públicos normalizados recibe 120 puntos de público. Con 85/15, el total sería `8 × 0.85 + 120 × 0.15 = 24.8`. Es una comprobación matemática, no una evaluación real.

No confundas el máximo de la rúbrica (120) con el puntaje ponderado. Si el público tiene cero votos y la ponderación del jurado es 85%, una evaluación perfecta del jurado aporta 102 puntos al ranking.

## 12. Comprueba permisos, móvil y respaldo

1. Con una tercera cuenta confirmada sin acceso, comprueba que el evento no aparezca.
2. Con el juez, comprueba que no pueda editar ponderación, votos públicos ni datos de organización.
3. Abre la web en tu teléfono y recorre el menú.
4. Para instalar la PWA, utiliza la opción de instalar del navegador; en iPhone/iPad utiliza Safari y **Compartir → Añadir a pantalla de inicio**, si la versión lo permite.
5. Abre online los eventos que necesites en el dispositivo antes de depender de su caché offline.
6. Los cambios offline quedan pendientes: al reconectar, verifica el indicador de sincronización antes de cerrar sesión.
7. Desde **Configuración → Exportar respaldo**, descarga un JSON de la edición y consérvalo de forma segura.

La caché no sustituye la base compartida ni un respaldo. El ranking offline puede estar desactualizado. Cerrar sesión elimina las copias locales del modo conectado; sincroniza primero tus cambios o descarga el borrador pendiente.

## 13. Limpieza OPCIONAL del evento temporal

Un evento de prueba cuenta para el límite de seis. Esta versión no tiene un botón de eliminar eventos en la PWA. Si quieres recuperar ese lugar, elimina únicamente el evento temporal después de verificar que no contiene datos reales.

**Esta operación borra de forma definitiva el evento de prueba y sus accesos, colecciones y evaluaciones. Exporta primero cualquier información que quieras conservar.**

En SQL Editor, primero identifica el evento:

```sql
select id, name, created_at
from public.jam_events
where name = 'Prueba de conexion';
```

Verifica que la fila sea la prueba que acabas de crear. Copia su UUID y úsalo en la consulta siguiente, sustituyendo el texto del ejemplo:

```sql
delete from public.jam_events
where id = 'PEGA_AQUI_EL_UUID_DEL_EVENTO_DE_PRUEBA'::uuid
  and name = 'Prueba de conexion';
```

No ejecutes esta consulta con el UUID de un evento real, ni elimines la condición de ID. Si no estás seguro de cuál fila corresponde, conserva el evento temporal y pide ayuda con el resultado de la primera consulta, sin compartir contraseñas.

## 14. Cómo seguir desarrollando después de publicar

### Ruta A: cambios sencillos desde GitHub

1. Abre el repositorio y selecciona `main`.
2. Abre el archivo que necesitas cambiar.
3. Usa el icono del lápiz para editarlo.
4. Revisa el cambio y confirma el commit. Para cambios importantes, utiliza una rama y una pull request antes de integrar a `main`.
5. Si Netlify está conectado por Git a `main`, el commit inicia una nueva compilación automáticamente.
6. Comprueba el nuevo estado Published en Deploys antes de revisar el sitio.

La base Supabase se conserva entre despliegues de la interfaz. No vuelvas a ejecutar la migración inicial cada vez que publicas código. Las modificaciones futuras del esquema deberán tener migraciones nuevas que preserven los datos.

### Ruta B: desarrollo en tu computadora

Esta parte es opcional y requiere instalar **Node.js 24** y **Git**. No hace falta para publicar desde los paneles.

En una terminal:

```sh
git clone https://github.com/danielopzs/GameJamHub.git
cd GameJamHub
npm ci
```

Crea en la raíz un archivo llamado exactamente `.env.local` con SOLO estas variables de conexión pública:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA_PUBLISHABLE
```

Sustituye ambos ejemplos. `.env.local` está ignorado por Git; no lo subas ni incluyas tokens administrativos.

Después ejecuta:

```sh
npm run dev:cloud
```

La terminal mostrará la dirección del servidor de desarrollo, normalmente en el puerto 5173. Ábrela en el navegador de tu computadora. Para enlaces de confirmación/recuperación en desarrollo, puedes agregar `http://localhost:5173/**` a Redirect URLs en Supabase, conservando la URL de producción.

Para compilar y probar:

```sh
npm run build:cloud
npm run preview
```

Las pruebas disponibles son `npm test`, `npm run test:ui` y `npm run test:db`. Las de interfaz requieren Chromium; las de base necesitan Docker y crean un PostgreSQL desechable. No ejecutes el bootstrap de pruebas contra tu proyecto Supabase real.

Cuando cambies las variables públicas locales, reinicia el servidor de desarrollo. Cuando las cambies en Netlify, genera un nuevo despliegue.

## 15. Diagnóstico por mensaje de error

| Mensaje / síntoma | Qué revisar primero | Acción |
|---|---|---|
| Netlify: **Site not found** | Dirección escrita y existencia del proyecto/despliegue | Abre la URL real desde Project overview y verifica un despliegue de producción Published; no inventes el subdominio |
| Deploy Failed | Build log | Revisa el primer error relevante: comando cloud, Node 24, dependencias y variables |
| Deploy Published pero la raíz da 404 | Publish directory y contenido del despliegue | Comprueba `dist` y que el despliegue contenga `index.html`; no publiques `src` |
| **Tu próximo jam, conectado.** | Variables públicas | Copia la URL y publishable del mismo proyecto a Netlify y recompila |
| Build bloqueado por clave | Tipo de clave | Usa publishable/anon, no un token administrativo, secret ni service_role |
| **Invalid API key** | Clave y proyecto | Vuelve a copiar la clave pública completa del proyecto de la URL utilizada |
| **Invalid login credentials** | Cuenta de usuario y contraseña | Busca ese correo en Authentication → Users del mismo proyecto; la contraseña no es la de PostgreSQL |
| **Email not confirmed** | Confirmación del usuario | Completa la confirmación o crea un usuario confirmado desde el Dashboard |
| **Email rate limit exceeded**, error SMTP o correo que no llega | Envío de correo | Para el piloto, crea usuarios confirmados desde el Dashboard; no desactives la confirmación como atajo |
| Relación `jam_events` no encontrada | Migración SQL y proyecto seleccionado | Comprueba que el SQL se ejecutó en el mismo proyecto que las claves de Netlify |
| Función `jam_create_event` no encontrada / error de schema cache | Funciones y caché Data API | Revisa las once funciones del paso 4.3; si existen, ejecuta `notify pgrst, 'reload schema';` y vuelve a probar |
| Entra a la cuenta pero no aparecen eventos | Acceso por correo | El anfitrión debe autorizar el correo exacto en Accesos del evento |
| No se puede guardar una evaluación | Rol y equipo | La cuenta debe tener permiso Juez y el equipo debe estar registrado; verifica también los 21 límites de la rúbrica |
| **CONFLICT** | Edición simultánea de la misma colección | Descarga el borrador, coordina los cambios y usa la opción de descartar/recargar antes de volver a aplicar lo necesario |
| **Failed to fetch** / error de red | URL, red y estado de Supabase | Comprueba la Project URL y que el proyecto no esté pausado; confirma que la red permita los servicios |
| En otra computadora no aparecen cambios | Demo o sincronización pendiente | Verifica que no uses Explorar demo local y que la otra sesión acceda al mismo evento con los cambios ya sincronizados |
| La web parece anterior después de publicar | Deploy y caché PWA | Primero espera Published. Luego recarga; si persiste, prueba una ventana privada antes de borrar datos del sitio. No borres una caché con cambios pendientes sin respaldo |
| `401` al administrar desde Codex | Tokens y configuración del entorno de Codex | No bloquea esta guía: puedes configurar todo desde los paneles sin esos tokens administrativos |

## 16. Alternativa manual si no quieres usar el build GitHub → Netlify

Usa una sola ruta para la primera publicación. La ruta por Git de los pasos anteriores es preferible para seguir desarrollando.

Si utilizas el paquete compilado `GameJamManager-Supabase-Netlify.zip`:

1. Descomprímelo.
2. Ejecuta `01_crear_base.sql` en Supabase si todavía no existe el esquema.
3. Abre `sitio/config.js` en un editor de texto plano.
4. Completa los dos campos con tus valores públicos:

   ```js
   window.__GAMEJAM_CONFIG__ = {
     supabaseUrl: "https://TU_PROYECTO.supabase.co",
     supabasePublishableKey: "TU_CLAVE_PUBLICA"
   };
   ```

5. Sube únicamente `sitio`, que contiene `index.html`, `config.js` y `assets`, mediante despliegue manual de Netlify.
6. Usa la URL que Netlify asigne y completa Authentication → URL Configuration.
7. Sigue los pasos de cuentas y verificación de esta guía.

**Distinción importante:** las variables de Netlify no modifican un ZIP ya compilado que subes manualmente. Para esa ruta editas `config.js`. En la ruta GitHub, las variables del build tienen prioridad y requieren recompilar. No mezcles ambas esperando que una cambie automáticamente la otra.

## 17. Qué queda dentro y fuera de esta primera versión

Incluido: eventos separados, perfiles de anfitrión/sede reutilizables, acceso de usuarios, comité, 31 tareas, tabla/kanban/cronograma, participantes, equipos, rúbrica de 120 puntos, ranking compartido, PWA, caché y respaldos.

El público se registra como votos manuales; no hay portal de voto público autenticado. El podio es provisional hasta completar el jueceo. Las funciones de ranking usan los jueces actualmente autorizados.

La versión Supabase + Netlify Free no tiene conectado un planificador para push con la aplicación cerrada. Conserva los recordatorios mientras la app está abierta, con permiso del navegador. No se ha contratado un servicio adicional.

Los planes gratuitos tienen cuotas y pueden pausar recursos inactivos; comprueba las condiciones vigentes. Antes de un evento real, verifica el acceso, el estado de Supabase, el despliegue Published y un respaldo reciente. Esta guía no promete disponibilidad garantizada ni copias administradas de un plan de pago.

## 18. Lista final de comprobación

- [ ] GitHub muestra el código en `danielopzs/GameJamHub`, rama `main`.
- [ ] Un proyecto Supabase está disponible y contiene las cuatro tablas.
- [ ] RLS está activo en las cuatro y existen las once funciones.
- [ ] Hay al menos un organizador y un juez con correo confirmado.
- [ ] Netlify compila `main` con `npm run build:cloud` y publica `dist`.
- [ ] Netlify tiene las dos variables públicas del mismo proyecto Supabase.
- [ ] El último despliegue de producción está Published.
- [ ] La URL usada es la que figura en el panel de Netlify.
- [ ] Esa URL aparece en Authentication → URL Configuration.
- [ ] La PWA permite entrar, crear un evento y guardar cambios en Supabase.
- [ ] El juez ve el evento autorizado y puede guardar su propia evaluación.
- [ ] El organizador ve el promedio actualizado.
- [ ] Una cuenta ajena no ve el evento.
- [ ] Se exportó un respaldo y se decidió qué hacer con los datos de prueba.

Si algo falla, comparte únicamente: el número de paso, el mensaje de error, la URL pública del sitio y, si procede, las líneas del build log revisadas para que no contengan claves o contraseñas. No hace falta compartir tokens administrativos para diagnosticar el flujo desde los paneles.
