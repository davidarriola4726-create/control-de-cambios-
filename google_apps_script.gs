/**
 * ============================================================================
 * SISTEMA DE RECLAMOS MYG — CÓDIGO GOOGLE APPS SCRIPT OFICIAL (TIEMPO REAL)
 * ============================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Abra su Google Sheet donde almacena los reclamos.
 * 2. Vaya al menú superior: Extensiones > Apps Script.
 * 3. Borre cualquier código anterior y pegue TODO este contenido.
 * 4. Haga clic en Guardar (ícono de disquete).
 * 5. Haga clic en "Implementar" (botón azul) > "Nueva implementación".
 * 6. Seleccione tipo: "Aplicación web".
 * 7. Ejecutar como: "Yo" (su cuenta).
 * 8. Quién tiene acceso: "Cualquier usuario" (Anyone).
 * 9. Haga clic en "Implementar" y autorice los permisos.
 * 
 * ESTRUCTURA OFICIAL DE COLUMNAS EN LA HOJA "RECLAMOS" (A hasta V - 22 Columnas):
 * A: ID_Reclamo (ej: N° 00001)
 * B: Ruta (ej: Ruta 1)
 * C: Vendedor (ej: BRYAN GOMEZ)
 * D: Cliente
 * E: Teléfono (TEXTO PURO, NO NÚMERO)
 * F: Factura
 * G: Photo / Foto
 * H: Producto
 * I: Motivo
 * J: Fecha
 * K: Hora
 * L: Firma Vendedor
 * M: Firma Cliente
 * N: Proceso Aceptado (SI/NO)
 * O: Proceso Rechazado (SI/NO)
 * P: En Proceso de Entrega (SI/NO)
 * Q: Cambio Entregado (SI/NO)
 * R: Dirección del Cliente
 * S: Cantidad de Producto
 * T: Cambio (SI/NO)           👉 Casilla de verificación
 * U: Devolución (SI/NO)       👉 Casilla de verificación
 * V: Reparación (SI/NO)       👉 Casilla de verificación
 */

function obtenerHojaReclamos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var sheet = null;
  
  // Buscar de forma insensible a mayúsculas/minúsculas: "Reclamos", "RECLAMOS", etc.
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toLowerCase();
    if (sName === "reclamos") {
      sheet = sheets[i];
      break;
    }
  }

  // Si no existe una hoja llamada "Reclamos", usar la hoja activa o la primera
  if (!sheet) {
    sheet = ss.getActiveSheet() || sheets[0];
  }

  var encabezadosOficiales = [
    "ID_Reclamo", "Ruta", "Vendedor", "Cliente", "Telefono", "Factura",
    "Photo", "Producto", "Motivo", "Fecha", "Hora", "FirmaVendedor", "FirmaCliente",
    "Proceso Aceptado", "Proceso Rechazado", "En Proceso de Entrega", "Cambio Entregado",
    "Dirección del Cliente", "Cantidad de Producto", "Cambio", "Devolución", "Reparación"
  ];

  if (!sheet || sheet.getLastRow() === 0) {
    if (!sheet) sheet = ss.insertSheet("Reclamos");
    sheet.appendRow(encabezadosOficiales);
    sheet.getRange(1, 1, 1, 22).setFontWeight("bold").setBackground("#0F52BA").setFontColor("#FFFFFF");
    sheet.getRange("E:E").setNumberFormat("@"); // Columna E: Teléfono estrictamente como TEXTO
    SpreadsheetApp.flush();
  } else {
    // Asegurar formato de texto en columna E para que no se convierta a número
    sheet.getRange("E:E").setNumberFormat("@");
    
    // Auto-completar encabezados para columnas T (20), U (21), V (22) si faltan
    var lastCol = sheet.getLastColumn();
    if (lastCol < 20) {
      sheet.getRange(1, 20).setValue("Cambio").setFontWeight("bold").setBackground("#0F52BA").setFontColor("#FFFFFF");
    }
    if (lastCol < 21) {
      sheet.getRange(1, 21).setValue("Devolución").setFontWeight("bold").setBackground("#0F52BA").setFontColor("#FFFFFF");
    }
    if (lastCol < 22) {
      sheet.getRange(1, 22).setValue("Reparación").setFontWeight("bold").setBackground("#0F52BA").setFontColor("#FFFFFF");
    }
    SpreadsheetApp.flush();
  }
  return sheet;
}

function obtenerSiguienteFilaVacia(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;
  
  // Buscar si hay filas vacías entre la fila 2 y lastRow
  var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    var val = colA[i][0];
    if (val === null || val === undefined || String(val).trim() === "") {
      var fila = i + 2;
      var vals = sheet.getRange(fila, 1, 1, Math.min(sheet.getLastColumn() || 6, 6)).getValues()[0];
      var estaVacia = vals.every(function(v) { return v === null || v === undefined || String(v).trim() === ""; });
      if (estaVacia) {
        return fila;
      }
    }
  }
  return lastRow + 1;
}

function extraerNumeroReclamo(str) {
  if (!str) return 0;
  var m = String(str).match(/(?:N[°º\.]?|#|\b)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function buscarFilaPorIdONumero(sheet, idBuscado, facturaOpcional) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  
  var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var colADisp = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var idNorm = String(idBuscado || '').trim().toLowerCase();
  var numBuscado = extraerNumeroReclamo(idBuscado);

  // 1. Búsqueda exacta por ID o por correlativo en Columna A
  for (var i = 0; i < colA.length; i++) {
    var val = String(colA[i][0] || '').trim();
    var valD = String(colADisp[i][0] || '').trim();
    if (val.toLowerCase() === idNorm || valD.toLowerCase() === idNorm) {
      return i + 2;
    }
    var numFila = extraerNumeroReclamo(val) || extraerNumeroReclamo(valD);
    if (numBuscado > 0 && numFila > 0 && numBuscado === numFila) {
      return i + 2;
    }
  }

  // 2. Búsqueda de respaldo por Factura en Columna F (si se proporcionó)
  if (facturaOpcional) {
    var factNorm = String(facturaOpcional).trim().toLowerCase();
    if (factNorm) {
      var colF = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
      for (var j = 0; j < colF.length; j++) {
        var fVal = String(colF[j][0] || '').trim().toLowerCase();
        if (fVal === factNorm) {
          return j + 2;
        }
      }
    }
  }

  return -1;
}

// -------------------------------------------------------------
// 📥 doGet: LECTURA EN TIEMPO REAL DE TODAS LAS FILAS SIN EXCEPCIÓN
// -------------------------------------------------------------
function doGet(e) {
  try {
    var sheet = obtenerHojaReclamos();
    var lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var numCols = Math.max(sheet.getLastColumn(), 22);
    var numRows = lastRow - 1;
    var dataValues = sheet.getRange(2, 1, numRows, numCols).getValues();
    var dataDisplay = sheet.getRange(2, 1, numRows, numCols).getDisplayValues();
    
    // Mapeo dinámico de columnas por encabezado
    var headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var tieneColumnaPiloto = false;
    var idxPhoto = 6;
    var idxProducto = 7;
    var idxMotivo = 8;
    var idxFecha = 9;
    var idxHora = 10;
    var idxFirmaV = 11;
    var idxFirmaC = 12;
    var idxProcAcept = 13;
    var idxProcRech = 14;
    var idxProcEntr = 15;
    var idxCambEntr = 16;
    var idxDireccion = 17;
    var idxCantidad = 18;
    var idxCambio = 19;      // Columna T (índice 19 en 0-based)
    var idxDevolucion = 20;  // Columna U (índice 20 en 0-based)
    var idxReparacion = 21;  // Columna V (índice 21 en 0-based)

    for (var c = 0; c < headers.length; c++) {
      var hName = String(headers[c] || '').trim().toLowerCase();
      if (hName === "piloto" || hName === "conductor" || hName === "chofer") {
        tieneColumnaPiloto = true;
      }
      if (hName === "cambio" && hName !== "cambio entregado") {
        idxCambio = c;
      }
      if (hName.indexOf("devoluc") !== -1) {
        idxDevolucion = c;
      }
      if (hName.indexOf("reparac") !== -1) {
        idxReparacion = c;
      }
      if (hName.indexOf("direcci") !== -1 || hName === "direccion") {
        idxDireccion = c;
      }
      if (hName.indexOf("cantid") !== -1 || hName === "cantidad") {
        idxCantidad = c;
      }
    }

    if (tieneColumnaPiloto) {
      // Formato anterior si aún tiene columna Piloto en G
      idxPhoto = 7;
      idxProducto = 8;
      idxMotivo = 9;
      idxFecha = 10;
      idxHora = 11;
      idxFirmaV = 12;
      idxFirmaC = 13;
      idxProcAcept = 14;
      idxProcRech = 15;
      idxProcEntr = 16;
      idxCambEntr = 17;
      idxDireccion = 18;
      idxCantidad = 19;
    }

    var lista = [];
    
    for (var i = 0; i < numRows; i++) {
      var row = dataValues[i];
      var rowDisp = dataDisplay[i];
      var id = String(rowDisp[0] || row[0] || '').trim();
      if (!id && !row[3] && !row[idxProducto]) continue; // Fila vacía
      
      // 📞 Teléfono: Leer exactamente como texto
      var tel = String(rowDisp[4] || row[4] || '').trim();
      if (tel.indexOf("'") === 0) {
        tel = tel.substring(1).trim();
      }

      // Casillas de verificación: Cambio (Col T), Devolución (Col U), Reparación (Col V)
      var rawCambio = String(rowDisp[idxCambio] || row[idxCambio] || '').trim().toUpperCase();
      var rawDevolucion = String(rowDisp[idxDevolucion] || row[idxDevolucion] || '').trim().toUpperCase();
      var rawReparacion = String(rowDisp[idxReparacion] || row[idxReparacion] || '').trim().toUpperCase();

      var esCambio = (rawCambio === "SI" || rawCambio === "TRUE" || rawCambio === "1");
      var esDevolucion = (rawDevolucion === "SI" || rawDevolucion === "TRUE" || rawDevolucion === "1");
      var esReparacion = (rawReparacion === "SI" || rawReparacion === "TRUE" || rawReparacion === "1");

      lista.push({
        id: id || ("N° " + ("00000" + (i + 1)).slice(-5)),
        ID_Reclamo: id,
        voucherNumber: id,
        ruta: String(rowDisp[1] || row[1] || ''),
        vendedor: String(rowDisp[2] || row[2] || ''),
        cliente: String(rowDisp[3] || row[3] || ''),
        telefono: tel,
        factura: String(rowDisp[5] || row[5] || ''),
        photo: String(row[idxPhoto] || ''),
        foto: String(row[idxPhoto] || ''),
        producto: String(rowDisp[idxProducto] || row[idxProducto] || ''),
        motivo: String(rowDisp[idxMotivo] || row[idxMotivo] || ''),
        fecha: formatearFecha(row[idxFecha]),
        hora: formatearHora(row[idxHora]),
        firmaVendedor: String(row[idxFirmaV] || ''),
        firmaCliente: String(row[idxFirmaC] || ''),
        procesoAceptado: String(rowDisp[idxProcAcept] || row[idxProcAcept] || ''),
        procesoRechazado: String(rowDisp[idxProcRech] || row[idxProcRech] || ''),
        enProcesoEntrega: String(rowDisp[idxProcEntr] || row[idxProcEntr] || ''),
        cambioEntregado: String(rowDisp[idxCambEntr] || row[idxCambEntr] || ''),
        direccion: String(rowDisp[idxDireccion] || row[idxDireccion] || ''),
        direccionCliente: String(rowDisp[idxDireccion] || row[idxDireccion] || ''),
        clientAddress: String(rowDisp[idxDireccion] || row[idxDireccion] || ''),
        cantidad: Number(row[idxCantidad]) || 1,
        cantidadProducto: Number(row[idxCantidad]) || 1,
        quantity: Number(row[idxCantidad]) || 1,
        // 3 Casillas de verificación
        cambio: esCambio,
        Cambio: esCambio ? "SI" : "NO",
        devolucion: esDevolucion,
        Devolucion: esDevolucion ? "SI" : "NO",
        reparacion: esReparacion,
        Reparacion: esReparacion ? "SI" : "NO"
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify(lista))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------------------------------------------------
// 📤 doPost: GUARDAR RECLAMO EN HOJA "RECLAMOS"
// -------------------------------------------------------------
function doPost(e) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RECLAMOS");
  
  if (!hoja) return ContentService.createTextOutput("ERROR: No encontré la hoja");

  let datosTexto = "{}";
  if (e.postData && e.postData.contents) {
    datosTexto = e.postData.contents;
  }

  try {
    const d = JSON.parse(datosTexto);
    
    hoja.appendRow([
      d.idReclamo || "",
      d.ruta || "",
      d.vendedor || "",
      d.cliente || "",
      d.telefono || "",
      d.factura || "",
      d.producto || "",
      d.motivo || "",
      new Date(),
      "",
      d.firmaVendedor || "",
      d.firmaCliente || "",
      "", "", "", "", "", "", "",
      d.cantidad || "",
      d.direccion || "",
      ""
    ]);

    return ContentService.createTextOutput("OK");
    
  } catch (error) {
    hoja.appendRow(["ERROR:", error.message]);
    return ContentService.createTextOutput("ERROR: " + error.message);
  }
}

// -------------------------------------------------------------
// 🛠️ FUNCIONES DE APOYO PARA FORMATEO DE FECHA Y HORA
// -------------------------------------------------------------
function formatearFecha(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val);
}

function formatearHora(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  }
  return String(val);
}
