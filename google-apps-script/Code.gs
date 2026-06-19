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
 * Parámetros esperados: nombre, correo, mensaje, origen
 * -----------------------------------------------------------------------------
 */

var SPREADSHEET_ID = "PEGAR_AQUI_EL_ID_DEL_SPREADSHEET";
var SHEET_NAME = "RSVP";
var HEADERS = ["Fecha", "Nombre", "Correo", "Mensaje", "Origen"];

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
      p.mensaje || "",
      p.origen || ""
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
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
