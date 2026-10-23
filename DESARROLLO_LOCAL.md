# Trabajar desde casa con Raspberry Pi

El nuevo recorrido de entrada funciona en **modo local con Node y SQLite**. No requiere Supabase, correo de confirmación, una cuenta de pago ni un deploy en Netlify. Los datos se guardan en la Raspberry; el navegador de tu computadora se conecta a ella.

## 1. Entrar y actualizar

Desde la terminal de tu computadora, entra por SSH como acostumbras. Después, en la terminal de la Raspberry:

```bash
cd ~/proyectos/GameJamHub
pwd
git branch --show-current
git status --short
node --version
npm --version
```

La carpeta debe ser la del repositorio y la rama debe ser `main`. Usa Node **24 LTS** (mínimo 22.13); si utilizas nvm y aparece `command not found`, ejecuta primero:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24
```

Si todavía no instalaste esa versión mediante nvm: `nvm install 24` y `nvm alias default 24`.

Si Git muestra cambios locales, guárdalos o revísalos antes de actualizar. No uses `reset --hard` ni borres `.data/` para solucionar un conflicto.

Con la app detenida mediante **Ctrl+C**, haz una copia de los datos existentes antes de actualizar:

```bash
if [ -d .data ]; then
  cp -a .data "$HOME/gamejam-datos-$(date +%Y%m%d-%H%M%S)"
fi
git switch main
git pull --ff-only origin main
npm ci
```

Si configuraste `DATA_DIR` en `.env`, respalda esa carpeta en lugar de `.data`. `git pull` actualiza código; no borra la base. `npm ci` necesita espacio libre y descarga las dependencias la primera vez.

## 2. Arrancar la aplicación

```bash
npm run dev -- --port 5174 --strictPort
```

Este comando inicia **dos servicios**: la API con SQLite en el puerto 3001 y la web en el 5174. Deja esa terminal abierta. No uses `dev:cloud`, porque abre el recorrido de Supabase; tampoco necesitas configurar sus claves para este modo.

Si ya tienes un `.env`, conserva `PORT=3001` para esta configuración. Deja `APP_PASSWORD` vacío en desarrollo para acceder directamente con las cuentas del jam. Si estableciste esa contraseña adicional, aparecerá primero el acceso HTTP del servidor con usuario `jam`.

## 3. Abrir en el navegador de tu computadora

La alternativa más predecible es un túnel SSH. Abre **otra terminal en tu computadora**, sin cerrar la que ejecuta la app:

```bash
ssh -N -L 5174:127.0.0.1:5174 TU_USUARIO@IP_DE_TU_RASPBERRY
```

Sustituye ambos datos por los que ya usas para entrar por SSH. Deja también esa terminal abierta y visita **http://localhost:5174/** en el navegador de tu computadora. El túnel hace que ese `localhost` llegue a la Raspberry.

Si tu computadora ya ocupa el puerto 5174, usa `ssh -N -L 5175:127.0.0.1:5174 TU_USUARIO@IP_DE_TU_RASPBERRY` y abre http://localhost:5175/.

También puedes abrir `http://IP_DE_TU_RASPBERRY:5174/` cuando ambos equipos estén en la misma red y puedan comunicarse. Una IP privada no permite conectarse desde fuera de casa sin acceso remoto configurado. Para conocer las IP actuales, ejecuta `hostname -I` en una segunda sesión SSH.

Si no abre, desde la Raspberry comprueba:

```bash
curl -I http://127.0.0.1:5174/
curl http://127.0.0.1:3001/api/health
```

El primero debe responder `200 OK`; el segundo, `{"ok":true,"storage":"sqlite"}`. Si funcionan, revisa el túnel o la dirección de red. Si no funcionan, revisa la terminal donde arrancaste la app. Un mensaje de puerto ocupado requiere detener la instancia anterior antes de volver a arrancar.

## 4. Probar el nuevo recorrido

1. La primera pantalla pregunta **«¿En qué jam trabajaremos hoy?»**. Escribe un nombre. Mayúsculas y espacios repetidos no crean eventos distintos.
2. Si no existe, registra nombre, usuario, correo y contraseña de al menos ocho caracteres o PIN numérico de seis a doce dígitos. **No hay cuentas ni contraseñas predeterminadas**. No se envía un correo de verificación.
3. Si ya tienes cuenta y quieres crear otro jam, pulsa **«Ya tengo cuenta de organizador»**. Un organizador puede crear hasta seis eventos.
4. Contesta el cuestionario: modalidad, sede o plataforma, evento marco, participantes, infraestructura, socios, apoyo civil y tamaño del equipo. En presencial se pregunta por la universidad y su relación. Cada respuesta se guarda al continuar, y puedes regresar.
5. Al terminar aparecen los datos capturados y las próximas tareas. Las 31 tareas de un jam nuevo empiezan pendientes; no se copian participantes, equipos ni jueces de demostración. El tamaño indicado en el cuestionario es una previsión: agrega después las personas reales y sus roles en Comité organizador.
6. Usa **«Agregar fechas»** para indicar inicio y fin. Hasta entonces las tareas se muestran por fase y prioridad, sin fechas inventadas. Con fechas, se calculan sus vencimientos respecto al inicio.
7. Puedes revisar el cuestionario desde **«Respuestas del evento»**. Sal del jam y vuelve a buscar su nombre para comprobar el acceso por usuario o correo y contraseña/PIN. Si ya terminaste el cuestionario, pasarás directamente al dashboard.

En el modo local, el organizador administra también las evaluaciones y selecciona al juez por su nombre. **No hay cuentas individuales de comité o jueces en esta variante**; los accesos individuales con permisos se conservan en la variante Supabase. No compartas la contraseña del organizador para simular esos permisos.

## Datos anteriores, sincronización y respaldos

Si ya había un evento en la base local de versiones anteriores, al arrancar se copia a las nuevas tablas sin eliminar las originales. Busca el **nombre anterior del evento**: la pantalla explicará que debes crear el primer acceso del organizador y completar las preguntas. Se conservan las fechas, tareas, equipos, evaluaciones y demás colecciones existentes. Realiza ese primer registro tú, en tu entorno de confianza; la versión anterior no tenía un propietario autenticado que pudiera verificarse.

Los datos que solo estaban en una demo del navegador no se importan automáticamente a SQLite. Exporta ese respaldo antes de limpiar el navegador.

La base, los accesos y las claves de notificación están en `.data/` por defecto. Conserva esa carpeta y sus respaldos fuera del repositorio. Los cambios pendientes del dashboard se guardan por usuario y jam en el navegador y se reintentan al reconectar mientras la sesión siga vigente. Para iniciar sesión o recargar el acceso necesitas que la API esté disponible; no se ofrece un nuevo inicio de sesión sin conexión. Si aparece un conflicto, descarga el borrador antes de recuperar la versión del servidor. No cierres sesión con cambios pendientes sin respaldarlos.

Las sesiones duran doce horas; tras expirar, vuelve a entrar al mismo jam. No existe recuperación por correo en el modo local, así que conserva tus credenciales. En desarrollo puedes probar por HTTP en la red doméstica; para exponer el servidor fuera de esa red configura HTTPS. `COOKIE_SECURE=1` exige HTTPS para enviar la cookie de sesión.

Los recordatorios push con la app cerrada requieren servidor encendido, contexto seguro y permiso del navegador. Esto no añade un servicio externo de pago. Las suscripciones de la versión anterior deben activarse de nuevo dentro del jam, para asociarlas al evento correcto.

Para apagar: **Ctrl+C** en la terminal de la app, **Ctrl+C** en la del túnel y luego `sudo shutdown -h now` en la Raspberry cuando hayas terminado con sus otros servicios.

## Validar cambios de código

```bash
npm test
npm run test:ui:local
npm run build
```

La prueba de interfaz usa una base temporal y Chromium. Si no está instalado, ejecuta `npx playwright install chromium` en un equipo compatible, o instala Chromium del sistema en la Raspberry. No necesita Supabase ni modifica `.data/`. `npm run test:ui` verifica por separado la variante cloud con servicios simulados.

`npm run build && npm start` sirve el modo local compilado en el puerto 3001. Para producción, establece `NODE_ENV=production` y una `APP_PASSWORD` adicional segura, usa HTTPS y un volumen persistente. El Dockerfile incluye esta variante. Netlify continúa usando `build:cloud`: **no aloja esta API SQLite**, por lo que los cambios locales no habilitan este recorrido en Netlify.
