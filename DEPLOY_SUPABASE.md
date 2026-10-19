# Activar Game Jam Manager con Supabase + Netlify Free

Esta guía no requiere comprar un dominio, contratar un servidor ni configurar funciones de pago. Usa **un solo proyecto Supabase Free para los seis eventos** y **un sitio Netlify Free**. Revisa las cuotas y condiciones vigentes en los paneles de ambos proveedores y selecciona explícitamente los planes gratuitos.

El código está preparado y probado localmente. Todavía no hay un proyecto Supabase ni un sitio Netlify conectado: deben crearse en tus cuentas. Ningún archivo contiene tus credenciales reales y no se han publicado datos.

## Camino sencillo: paquete listo, sin instalar Node

El paquete `GameJamManager-Supabase-Netlify.zip` contiene:

- `sitio/`: la PWA ya compilada; esta es la carpeta que publicarás.
- `01_crear_base.sql`: tablas, permisos y funciones de PostgreSQL.
- `LEEME.md`: estas instrucciones.

### 1. Crea el proyecto gratuito de Supabase

1. Entra a https://supabase.com/dashboard y crea una cuenta.
2. Crea una organización/proyecto en el **plan Free**. Un proyecto aloja los seis eventos; no necesitas seis proyectos.
3. Elige una región cercana a tus usuarios y una contraseña fuerte para la base de datos. Guárdala de forma privada; no se utiliza en la PWA.
4. Espera a que el proyecto esté operativo.
5. Abre **SQL Editor → New query**.
6. Abre `01_crear_base.sql` con un editor de texto, copia todo su contenido en SQL Editor y ejecuta **Run**. Ejecútalo una sola vez en el proyecto nuevo.
7. Comprueba en Table Editor que existen `jam_events`, `jam_members`, `jam_state` y `jam_evaluations`. Que estén vacías es correcto: crearás tus eventos desde la aplicación.

**No ejecutes los archivos de `supabase/tests/` en tu proyecto real.** Son exclusivamente para la base de datos desechable de pruebas.

### 2. Conecta la web con el proyecto

1. En el panel de Supabase, abre **Connect** o **Project Settings → API / API Keys** (la ubicación puede variar).
2. Copia la **Project URL**, con formato `https://TU_PROYECTO.supabase.co`.
3. Copia la clave **Publishable**, que comienza con `sb_publishable_`. La clave pública **anon** de proyectos antiguos también es compatible.
4. Abre `sitio/config.js` con un editor de texto y completa exclusivamente estos dos campos:

```js
window.__GAMEJAM_CONFIG__ = {
  supabaseUrl: "https://TU_PROYECTO.supabase.co",
  supabasePublishableKey: "TU_CLAVE_PUBLICA"
};
```

Estos valores son públicos por diseño: los permisos RLS protegen los registros. **Nunca incluyas la contraseña de PostgreSQL, una clave `secret` ni `service_role`.** La aplicación rechaza esas claves como configuración, pero tampoco debes publicarlas en un archivo.

### 3. Publica en Netlify Free

1. Crea tu cuenta en https://app.netlify.com y elige el plan gratuito.
2. Abre https://app.netlify.com/drop o la opción de despliegue manual.
3. Arrastra **solo la carpeta `sitio`**, que debe contener `index.html`, `config.js` y `assets/`. No arrastres el paquete completo ni la carpeta del código fuente.
4. Espera la publicación. Netlify te asignará una dirección HTTPS terminada en `.netlify.app`.
5. Abre esa dirección. Con la configuración correcta aparecerá **“Bienvenido de nuevo”**. Si aparece “Tu próximo jam, conectado”, vuelve a revisar `config.js` y publica de nuevo `sitio`.

El despliegue manual usa `config.js`; las variables de Netlify no alteran archivos ya compilados. Cada actualización manual requiere volver a subir la carpeta. No necesitas `npm start`, Docker, un servidor SQLite, un dominio propio ni variables secretas de Netlify.

### 4. Configura las direcciones de autenticación

En Supabase abre **Authentication → URL Configuration**:

- **Site URL:** la dirección HTTPS exacta del sitio Netlify.
- **Redirect URLs:** agrega esa misma dirección y `https://TU_SITIO.netlify.app/**` para confirmaciones y recuperación de acceso.

Si cambias el nombre del sitio, actualiza esos campos. Mantén activada la confirmación de correo; no la desactives para sortear problemas de envío, porque los permisos de acceso usan el correo verificado de la cuenta.

### 5. Crea el primer usuario sin depender de un servicio de correo

Para esta prueba con tu comité, el método más directo es que el anfitrión cree las cuentas desde **Supabase Dashboard → Authentication → Users → Add user / Create new user**:

1. Crea tu usuario con tu correo y una contraseña fuerte; utiliza la opción de confirmarlo automáticamente desde el panel, si aparece. Si la interfaz cambia, comprueba que el usuario figure con su correo confirmado antes de entrar.
2. Inicia sesión en la web publicada con ese correo y contraseña.
3. Crea tu primer evento. Recibirás las 31 tareas pendientes, sin votos, equipos o participantes ficticios.
4. Repite la creación de cuentas para el comité y los jueces, confirmando sus correos desde el panel. Comparte contraseñas temporales por un canal privado y permite que cada persona cambie su contraseña desde **Mi cuenta** (icono de ajustes en la barra superior), o usa el flujo de recuperación cuando tengas correo configurado.

La aplicación también ofrece registro y recuperación por correo. **El envío de prueba incluido por Supabase puede restringirse a miembros de tu organización y tiene límites; no asumas que enviará emails a todos los jueces.** Para registro público o invitaciones por correo configura un proveedor SMTP propio compatible con tu presupuesto, o continúa con la creación manual de usuarios confirmados desde el Dashboard. Esta integración no contrata ni configura correo de pago.

### 6. Da acceso y comienza el jueceo

1. Dentro del evento, abre **Accesos del evento** en la barra superior.
2. Agrega el nombre y el **correo exacto de la cuenta** de cada persona; selecciona **Organizador** o **Juez**. Esto autoriza el acceso, pero no crea la cuenta ni envía correos.
3. El comité operativo (roles de logística, marketing, etc.) se administra en **Comité organizador**. Un registro en ese directorio no concede acceso a la web: el acceso se concede por separado, por seguridad.
4. Registra los equipos desde **Evaluación y premios → Equipo**, usando códigos únicos de letras, números, guion o guion bajo (por ejemplo `T01`).
5. Registra hasta 100 personas desde **Participantes**, asigna su equipo y confirma su entrada.
6. Cada juez entra con su propia cuenta, abre el evento y guarda sus evaluaciones. No puede suplantar a otro juez ni cambiar los votos o la ponderación.
7. El anfitrión consulta el ranking. Los datos se refrescan en primer plano cada 30 segundos cuando hay una nueva revisión del evento; los cambios propios se envían aproximadamente 600 ms después de guardarlos.

El propietario puede consultar sin calificar. Si también será juez, autoriza su mismo correo con el rol **Juez**: conserva sus permisos de propietario y ocupa uno de los cinco lugares de jueceo.

### 7. Verifica antes de usar datos reales

- Abre dos navegadores/perfiles: uno como organizador y otro como juez.
- Guarda una evaluación y verifica que el promedio cambie en la cuenta del organizador.
- Comprueba que el juez no tenga acceso a tareas, participantes ni cambios de ponderación.
- Inicia sesión con una cuenta ajena: no debe aparecer el evento hasta que autorices su correo.
- Prueba la PWA en un dispositivo móvil y exporta un respaldo desde Configuración.
- Revisa el indicador superior: **“cambios pendientes” no significa “guardado en Supabase”**. Espera la confirmación antes de cerrar sesión.

Estas verificaciones remotas quedan pendientes hasta crear y configurar los servicios. Las pruebas locales no sustituyen esa comprobación final.

## Alternativa: despliegue desde GitHub con actualizaciones automáticas

1. Sube el código fuente actualizado a tu repositorio GitHub.
2. En Netlify importa ese repositorio. `netlify.toml` define `npm run build:cloud`, publicación de `dist` y Node 24.
3. Antes del despliegue agrega estas variables para el build:

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable (o usa `VITE_SUPABASE_ANON_KEY` con una clave anon antigua) |

4. Genera un nuevo despliegue y configura las URL de autenticación como arriba. Cambiar variables requiere recompilar, no basta con refrescar el navegador.
5. En este método, las variables del build tienen prioridad sobre `config.js`. Usa un solo método de configuración para evitar confusiones.

Para desarrollar localmente, copia `.env.example` a `.env.local`, completa únicamente las variables públicas de Supabase y ejecuta `npm ci` y `npm run dev:cloud`.

## Alcance y límites

- Hasta **6 eventos por anfitrión**, **10 accesos de organización**, **10 miembros operativos**, **5 jueces** y **100 participantes** por evento. Los límites están también en PostgreSQL, no solo en la interfaz.
- Una persona puede participar en varios eventos con la misma cuenta. Los participantes no necesitan cuentas.
- Las evaluaciones se guardan por evento, juez autenticado y equipo. Se validan 21 criterios, máximos individuales y un máximo total de 120 puntos. Reenviar una evaluación actualiza esa misma fila.
- El ranking se calcula en PostgreSQL con los jueces actualmente autorizados. El público se registra manualmente; no existe un portal de voto público autenticado. Los resultados siguen siendo provisionales hasta completar el jueceo.
- Los datos de organización se almacenan como colecciones JSONB versionadas. Si dos personas cambian simultáneamente la misma colección, la segunda recibe un conflicto. Puede descargar su borrador y recargar el servidor para resolverlo, sin sobrescritura silenciosa.
- Hay caché local y una cola de cambios por usuario/evento. Solo se puede abrir offline un evento que ya se haya descargado en ese dispositivo. El ranking offline puede estar desactualizado. Al cerrar sesión se borran las copias locales del modo conectado; primero sincroniza o descarga los cambios pendientes.
- No uses equipos compartidos para conservar datos offline de participantes. No recopiles datos sensibles innecesarios y exporta respaldos antes/después de cada evento.
- La versión gratuita conectada **no incluye push programado con la app cerrada**. Sí incluye recordatorios con la app abierta y permisos del navegador. No se ha contratado un planificador ni servicios adicionales.
- Los planes gratuitos pueden imponer cuotas, suspensión por inactividad y condiciones de recuperación. No prometemos disponibilidad continua ni respaldos administrados de pago. Revisa el estado de ambos servicios y prueba el acceso antes de cada evento.
