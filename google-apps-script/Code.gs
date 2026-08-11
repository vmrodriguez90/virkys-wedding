/**
 * las virkys — RSVP endpoint (Google Apps Script Web App)
 *
 * Recibe los datos del formulario por query params (GET) o por body (POST)
 * y agrega una fila al Spreadsheet.
 *
 * --- Cómo publicarlo ---------------------------------------------------------
 * 1. Creá un Google Spreadsheet y copiá su ID desde la URL:
 *      https://docs.google.com/spreadsheets/d/<ESTE_ES_EL_ID>/edit
 * 2. Pegá ese ID abajo en SPREADSHEET_ID.
 * 3. script.google.com → Nuevo proyecto → pegá este archivo.
 * 4. Implementar → Nueva implementación → tipo "Aplicación web".
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona
 * 5. Copiá la URL que termina en /exec y pegala en script.js (RSVP_ENDPOINT).
 *
 * --- Para actualizar el código ya publicado -----------------------------------
 * Pegá el archivo nuevo en el editor y usá Implementar → Administrar
 * implementaciones → ✏️ → Versión: "Nueva versión" → Implementar.
 * Así la URL /exec se mantiene igual. (Una "Nueva implementación" genera
 * OTRA URL y habría que volver a cambiarla en script.js.)
 *
 * Al agregar el email de confirmación, la primera vez Apps Script va a pedir
 * un permiso nuevo ("enviar correo en tu nombre"): ejecutá cualquier función
 * desde el editor (▶) y aceptá el permiso antes de publicar la versión.
 *
 * Parámetros esperados: nombre, correo, restriccion, mensaje, origen
 * -----------------------------------------------------------------------------
 */

var SPREADSHEET_ID = "1QnPuzOsk1eixJZZJpy3XkADzoFglo9kzZDkbVWhGX8M";
var SHEET_NAME = "RSVP";
var HEADERS = ["Fecha", "Nombre", "Correo", "Restricción/Preferencia", "Mensaje", "Origen"];

// Email de confirmación que se envía al invitado tras guardar su RSVP.
// Poné SEND_CONFIRMATION en false para desactivarlo sin tocar el resto.
var SEND_CONFIRMATION = true;
var EMAIL_SUBJECT = "¡nos vemos en la boda! — las virckys";

function buildEmailBody(nombre) {
  return (
    (nombre ? "¡Hola " + nombre + "!" : "¡Hola!") +
    "\n\n" +
    "Este correo quiere decir que has completado tu asistencia y que nosotras " +
    "estamos muy contentas de que vengas a nuestra boda 💘\n\n" +
    "Como te contamos, la fecha es el sábado 29 de mayo a las 19:30 h en The Madrid EDITION.\n" +
    "Aquí tienes la dirección exacta: Pl. de Celenque, 2, Centro, 28013 Madrid\n\n" +
    "Es un día súper especial para nosotras y, sobre todo, un día de festejo. " +
    "Así que lo más importante es que vengas con ganas de celebrar con nosotras. " +
    "Todo lo demás da igual.\n\n" +
    "Vamos a comer rico, bailar mucho y disfrutar con la gente que más queremos " +
    "y que forma parte de nuestra vida.\n\n" +
    "Tenemos muchísimas ganas de que llegue el día y de compartirlo contigo.\n\n" +
    "Más cerca de la fecha, te volvemos a escribir, no te preocupes.\n\n" +
    "Un abrazo grande,\n" +
    "Las virckys"
  );
}

// Versión HTML del mismo texto (permite la negrita en el nombre del lugar).
// El texto plano de arriba queda como respaldo para clientes sin HTML.
function buildEmailHtmlBody(nombre) {
  // El nombre viene del formulario: lo escapamos para que caracteres como
  // < > & no rompan (ni inyecten) el HTML del email.
  var nombreHtml = String(nombre || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    "<p>" + (nombreHtml ? "¡Hola " + nombreHtml + "!" : "¡Hola!") + "</p>" +
    "<p>Este correo quiere decir que has completado tu asistencia y que nosotras " +
    "estamos muy contentas de que vengas a nuestra boda 💘</p>" +
    "<p>Como te contamos, la fecha es el sábado 29 de mayo a las 19:30 h en " +
    "<b>The Madrid EDITION</b>.<br>" +
    "Aquí tienes la dirección exacta: Pl. de Celenque, 2, Centro, 28013 Madrid</p>" +
    "<p>Es un día súper especial para nosotras y, sobre todo, un día de festejo. " +
    "Así que lo más importante es que vengas con ganas de celebrar con nosotras. " +
    "Todo lo demás da igual.</p>" +
    "<p>Vamos a comer rico, bailar mucho y disfrutar con la gente que más queremos " +
    "y que forma parte de nuestra vida.</p>" +
    "<p>Tenemos muchísimas ganas de que llegue el día y de compartirlo contigo.</p>" +
    "<p>Más cerca de la fecha, te volvemos a escribir, no te preocupes.</p>" +
    "<p>Un abrazo grande,<br>" +
    "Las virckys</p>"
  );
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // Evita que dos envíos simultáneos pisen la misma fila.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // Visita a la URL sin datos (curiosos, bots, health checks): no guardamos
    // una fila vacía ni mandamos email.
    if (!(p.nombre || "").trim() && !(p.correo || "").trim()) {
      return json({ ok: true, skipped: "sin datos" });
    }

    var sheet = getSheet();
    sheet.appendRow([
      new Date(),
      p.nombre || "",
      p.correo || "",
      p.restriccion || "",
      p.mensaje || "",
      p.origen || ""
    ]);

    sendConfirmationEmail(p);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Manda el email pre-determinado al correo del invitado. Si el envío falla
// (correo inválido, cuota agotada, etc.) no rompe el guardado en el Sheet.
function sendConfirmationEmail(p) {
  if (!SEND_CONFIRMATION) return;
  var correo = (p.correo || "").trim();
  // Chequeo mínimo de formato para no gastar cuota en direcciones rotas.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;
  try {
    MailApp.sendEmail({
      to: correo,
      subject: EMAIL_SUBJECT,
      body: buildEmailBody((p.nombre || "").trim()),
      htmlBody: buildEmailHtmlBody((p.nombre || "").trim()),
      name: "las virckys"
    });
  } catch (err) {
    // No re-lanzamos: el RSVP ya quedó guardado, que es lo importante.
    Logger.log("No se pudo enviar el email a " + correo + ": " + err);
  }
}

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Escribe la fila de encabezados la primera vez.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
