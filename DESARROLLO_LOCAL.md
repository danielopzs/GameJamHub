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

1. La primera pantalla pregunta **«¿En qué jam trabajaremos hoy?»**. Escribe el nombre y la **edición** en campos separados: por ejemplo, `Global Game Jam` y `2027`. Mayúsculas y espacios repetidos no crean eventos distintos. Los eventos de versiones anteriores conservan su nombre y una edición vacía; búscalos así y después separa ambos campos desde Editar evento.
2. Si no existe, registra nombre, usuario, correo y contraseña de al menos ocho caracteres o PIN numérico de seis a doce dígitos. **No hay cuentas ni contraseñas predeterminadas**. No se envía un correo de verificación.
3. Si ya tienes cuenta y quieres crear otro jam, pulsa **«Ya tengo cuenta de organizador»**. Un organizador puede crear hasta seis eventos.
4. Contesta el cuestionario: modalidad **presencial, virtual o híbrida**; inicio y fin del jam; inicio de planeación; sede y/o plataforma con enlace de acceso; evento marco; participantes; infraestructura; socios; apoyo civil o estudiantil y equipo. El inicio de planeación se propone con la fecha de registro; puedes ajustarlo. Las horas son las de tu navegador y se guardan como instantes UTC. Cada respuesta se guarda al continuar.
5. Al terminar aparecen los datos capturados y las próximas tareas. Las 31 tareas de un jam nuevo empiezan pendientes; no se copian participantes, equipos ni jueces de demostración. Si ya tienes comité, agrega sus perfiles (nombre, correo y rol) en la última pregunta. Puedes completarlos después en Comité organizador, hasta diez personas incluyendo al organizador. Cada persona puede tener varios roles de campo: abre su selector de roles y marca todas sus responsabilidades. Sigue contando como una sola persona y mantiene sus tareas asignadas.
6. El cronograma se genera con esas fechas. En Tareas → Cronograma verás fechas reales, responsables, avance y tareas por fase; puedes desplegar o plegar cada fase. Si hay menos de 60 días disponibles, se comprimen los plazos previos. La entrega se recuerda dos horas antes del cierre real; el jueceo se sitúa al cierre y la retrospectiva después. Puedes cambiar fechas desde Editar evento.
7. **«Respuestas del evento»** abre un resumen guardado con el botón Volver al dashboard. Para recorrer el cuestionario otra vez, pulsa Editar configuración. Sal del jam y vuelve a buscar su nombre y edición para comprobar el acceso. Si ya terminaste el cuestionario, pasarás directamente al dashboard.

### Tamaño del evento y enlace de acceso

El tamaño se calcula **solo con participantes, sin sumar organizadores**:

| Participantes | Tamaño |
| --- | --- |
| 0–15 | Pequeño |
| 16–50 | Mediano |
| 51 o más | Grande |

El cuestionario y el resumen muestran el tamaño previsto según los participantes esperados (se acepta cero). Las métricas y su CSV distinguen ese dato del tamaño por inscritos reales. El cupo de inscripción es un ajuste separado y sigue teniendo un máximo de 100 en esta iteración.

En Virtual e Híbrido se pide el nombre de la plataforma y un **enlace HTTP/HTTPS para sumarse**. El enlace aparece en el dashboard, en la página de inscripción y en el comprobante personal. Puedes corregirlo desde Editar evento. Los eventos anteriores conservan sus datos: si les falta el enlace, el dashboard ofrece Agregar enlace. Los miembros que tenían un solo rol lo conservan; puedes sumar otros roles sin volver a registrarlos. Estos roles de campo no modifican los permisos de su cuenta de acceso.

## 5. Jurado y comité con cuentas propias

1. Entra como organizador y abre **Accesos del jurado**. Esta sección administra también los accesos del comité.
2. Escribe nombre, usuario, correo y contraseña inicial (o deja la contraseña vacía si el usuario y correo ya tienen cuenta). Selecciona el perfil **Jurado** o **Comité organizador** y pulsa Crear acceso. No se envía ninguna invitación por correo: comparte personalmente la URL accesible, el nombre del jam, su edición, el usuario y la contraseña inicial.
3. Para el comité, el correo debe existir primero en los perfiles de Comité organizador. Un perfil del cuestionario es un registro de persona y rol; el acceso se concede explícitamente en esta sección. Esto evita crear o compartir contraseñas durante el cuestionario.
4. El invitado abre la misma página de inicio, busca el mismo nombre y edición y usa su cuenta. Un juez ve equipos, enlaces de entrega, rúbrica y sus propios avisos; guarda únicamente sus evaluaciones (21 criterios, hasta 120 puntos). Otro juez tiene registros y revisiones independientes. El comité ve las tareas y puede distribuir responsables y cambiar estados; no modifica fechas, premios ni evaluaciones.
5. Desde el dashboard del organizador, usa Evaluación y premios para registrar equipos, consultar el ranking y, si hace falta, capturar evaluaciones manuales. Los accesos individuales están limitados a cinco jueces y nueve integrantes además del organizador. Revocar un acceso invalida sus sesiones en esa edición y conserva las evaluaciones ya entregadas.
6. Antes de evaluar, registra los juegos entregados en **Resumen → Registrar o corregir entrega de un juego**. El juez verá ese enlace. Esto también actualiza la métrica de entregas.

El panel del juez advierte antes de abandonar una evaluación sin guardar. No tiene una cola de evaluaciones offline: guarda con conexión y comprueba el mensaje de confirmación. No compartas la cuenta del organizador.

## 6. Inscripciones automáticas y check-in

1. En Participantes, activa **Abrir inscripciones públicas**, ajusta el cupo (hasta 100) y espera a que el indicador confirme el guardado.
2. Copia el Enlace de registro. Con la Raspberry en una red local, abre la app desde `http://IP_DE_TU_RASPBERRY:5174/` para obtener un enlace que puedan usar otros dispositivos de esa red. Un enlace generado con localhost apunta al dispositivo de quien lo abre. Para personas fuera de casa necesitas que el servidor esté disponible desde Internet, con HTTPS; Netlify por sí solo no aloja esta API local.
3. El participante abre el enlace, escribe nombre, correo y, opcionalmente, el código de un equipo existente. Acepta compartir esos datos con el comité y confirma su inscripción. No crea una cuenta y no necesita verificar un correo.
4. La app controla el cupo y evita correos duplicados en la misma edición. Al terminar muestra un código de entrada y un enlace personal. **El participante debe guardar ese enlace**: esta versión no envía emails automáticos. El enlace contiene un token privado y permite ver únicamente su propio comprobante y avisos.
5. Los inscritos aparecen en Participantes sin capturarlos de nuevo. Busca por nombre, correo o código, asigna equipo si falta y marca **Confirmada** al llegar. El comprobante personal reflejará ese check-in al recargar (o en la siguiente actualización automática).
6. Exportar participantes descarga un CSV con los registros. El botón Recuperar comprobante de cada fila genera un nuevo enlace personal, invalida el anterior y te permite compartirlo con la persona que lo perdió. Una inscripción eliminada deja de tener un comprobante válido.
7. Puedes cerrar inscripciones sin eliminar a los registrados. Los comprobantes existentes siguen funcionando. Si bajas el cupo por debajo del total inscrito, la app deja de aceptar nuevas inscripciones; no elimina registros.

Esto cubre inscripción, cupo, comprobantes y check-in para probar el flujo que hoy haces en Luma. No incluye cobros, envío de correo, lista de espera ni una publicación automática en Internet.

## 7. Premios, recordatorios y métricas para patrocinadores

- **Premios:** registra nombre, patrocinador, cantidad, valor unitario declarado en MXN, lugar y estado (Propuesto, Confirmado o Entregado). El panel suma el valor previsto, confirmado y entregado. Los premios confirmados con lugar se muestran junto al podio provisional; la entrega física se marca manualmente, no se presume por aparecer en el ranking. Los pases VIP/booths siguen configurándose en Editar evento; agrega también su valor estimado como premio si quieres incluirlo en el presupuesto.
- **Recordatorios:** hay avisos automáticos y avisos que puedes programar por fecha para Organizadores, Jueces, Participantes o Todos. Rojo indica urgencia, verde acción requerida y azul información, siempre con texto. Los portales de invitados muestran su audiencia y los avisos generales. El banner del dashboard resalta los próximos avisos del organizador. Web Push requiere permiso, contexto seguro y el servidor funcionando; el color de las notificaciones del sistema depende del navegador.
- **Pulso del evento:** muestra inscritos, check-ins, equipos, personas asignadas a equipos, juegos entregados y valor confirmado de premios. Se consulta al servidor cada cinco segundos con conexión. Marca las entregas con un enlace real; escribir solo el nombre de un juego al crear el equipo no equivale a una entrega. Exportar métricas genera un CSV agregado con nombre del evento, edición y fecha de corte para preparar un pitch de patrocinio sin exportar datos personales.

## Datos anteriores, sincronización y respaldos

Si ya había un evento en la base local de versiones anteriores, al arrancar se copia a las nuevas tablas sin eliminar las originales. Busca el **nombre anterior del evento**: la pantalla explicará que debes crear el primer acceso del organizador y completar las preguntas. Se conservan las fechas, tareas, equipos, evaluaciones y demás colecciones existentes. Realiza ese primer registro tú, en tu entorno de confianza; la versión anterior no tenía un propietario autenticado que pudiera verificarse.

Los datos que solo estaban en una demo del navegador no se importan automáticamente a SQLite. Exporta ese respaldo antes de limpiar el navegador.

La base, los accesos y las claves de notificación están en `.data/` por defecto. Conserva esa carpeta y sus respaldos fuera del repositorio. Los cambios pendientes del dashboard se guardan por usuario y jam en el navegador y se reintentan al reconectar mientras la sesión siga vigente. Para iniciar sesión o recargar el acceso necesitas que la API esté disponible; no se ofrece un nuevo inicio de sesión sin conexión. Si aparece un conflicto, descarga el borrador antes de recuperar la versión del servidor. No cierres sesión con cambios pendientes sin respaldarlos.

Las sesiones duran doce horas; tras expirar, vuelve a entrar al mismo jam. No existe recuperación por correo en el modo local, así que conserva tus credenciales. En desarrollo puedes probar por HTTP en la red doméstica; para exponer el servidor fuera de esa red configura HTTPS. `COOKIE_SECURE=1` exige HTTPS para enviar la cookie de sesión.

Los recordatorios push con la app cerrada requieren servidor encendido, contexto seguro y permiso del navegador. Esto no añade un servicio externo de pago. Las suscripciones de la versión anterior deben activarse de nuevo dentro del jam, para asociarlas al evento correcto.

Para apagar: **Ctrl+C** en la terminal de la app, **Ctrl+C** en la del túnel y luego `sudo shutdown -h now` en la Raspberry cuando hayas terminado con sus otros servicios.

## Validar cambios de código

Para liberar un usuario o correo de pruebas, detén la aplicación y ejecuta en la máquina que guarda la base:

```bash
npm run user:delete -- danielopzs
```

Puedes usar el correo completo en lugar del usuario. El comando exige una única coincidencia, crea primero un respaldo SQLite en `.data/backups/` (o dentro de `DATA_DIR`) e invalida las sesiones y accesos de esa cuenta. Conserva los eventos y permite registrar nuevamente a su organizador buscando el mismo nombre y edición. Si la cuenta ya entregó evaluaciones, conserva su autor histórico con credenciales desactivadas y libera el usuario y correo originales. No borra evaluaciones ni participantes. Este comando solo actúa en SQLite local, no en Supabase.

```bash
npm test
npm run test:ui:local
npm run build
```

La prueba de interfaz usa una base temporal y Chromium. Si no está instalado, ejecuta `npx playwright install chromium` en un equipo compatible, o instala Chromium del sistema en la Raspberry. No necesita Supabase ni modifica `.data/`. `npm run test:ui` verifica por separado la variante cloud con servicios simulados.

`npm run build && npm start` sirve el modo local compilado en el puerto 3001. Para producción, establece `NODE_ENV=production` y una `APP_PASSWORD` adicional segura, usa HTTPS y un volumen persistente. Esa contraseña HTTP protege todo el sitio, incluyendo formularios de inscripción y portales de invitados; corresponde a un entorno privado. Las pruebas de inscripción compartida de esta guía usan el entorno de desarrollo en la red doméstica con `APP_PASSWORD` vacío. El Dockerfile incluye esta variante. Netlify continúa usando `build:cloud`: **no aloja esta API SQLite**, por lo que los cambios locales no habilitan este recorrido en Netlify.
