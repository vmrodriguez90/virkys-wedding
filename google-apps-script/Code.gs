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

var SPREADSHEET_ID = "PEGAR_AQUI_EL_ID_DEL_SPREADSHEET";
var SHEET_NAME = "RSVP";
var HEADERS = ["Fecha", "Nombre", "Correo", "Restricción/Preferencia", "Mensaje", "Origen"];

// Email de confirmación que se envía al invitado tras guardar su RSVP.
// Poné SEND_CONFIRMATION en false para desactivarlo sin tocar el resto.
var SEND_CONFIRMATION = true;
var EMAIL_SUBJECT = "¡nos vemos en la boda! — las virckys";

function buildEmailBody(nombre) {
  var saludo = nombre ? "hola, " + nombre + "!" : "hola!";
  return (
    saludo +
    "\n\n" +
    "recibimos tu confirmación. ya estás en la lista :)\n\n" +
    "te esperamos el 29 de mayo de 2027 en madrid.\n" +
    "más cerca de la fecha te mandamos todos los detalles.\n\n" +
    "aquí. acá. ustedes y nosotras.\n\n" +
    "con amor,\n" +
    "las virckys"
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
    var sheet = getSheet();
    var p = (e && e.parameter) ? e.parameter : {};

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
