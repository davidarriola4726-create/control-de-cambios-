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
 * ESTRUCTURA OFICIAL DE COLUMNAS EN LA HOJA "RECLAMOS" (A hasta S):
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
 *
 * NOTA: El campo "Piloto / Conductor" ha sido eliminado completamente.
 * Si su hoja anterior aún tiene una columna "Piloto", este script es compatible
 * automáticamente y dejará dicha celda en blanco sin romper ningún dato.
 */

function obtenerHojaReclamos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("RECLAMOS");
  if (!sheet) {
    sheet = ss.insertSheet("RECLAMOS");
    sheet.appendRow([
      "ID_Reclamo", "Ruta", "Vendedor", "Cliente", "Telefono", "Factura",
      "Photo", "Producto", "Motivo", "Fecha", "Hora", "FirmaVendedor", "FirmaCliente",
      "Proceso Aceptado", "Proceso Rechazado", "En Proceso de Entrega", "Cambio Entregado",
      "Dirección del Cliente", "Cantidad de Producto"
    ]);
    sheet.getRange(1, 1, 1, 19).setFontWeight("bold").setBackground("#0F52BA").setFontColor("#FFFFFF");
    sheet.getRange("E:E").setNumberFormat("@"); // Columna E: Teléfono estrictamente como TEXTO
    SpreadsheetApp.flush();
  } else {
    // Asegurar formato de texto en columna E para que no se convierta a número
    sheet.getRange("E:E").setNumberFormat("@");
  }
  return sheet;
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
    
    var numCols = Math.max(sheet.getLastColumn(), 19);
    var numRows = lastRow - 1;
    var dataValues = sheet.getRange(2, 1, numRows, numCols).getValues();
    var dataDisplay = sheet.getRange(2, 1, numRows, numCols).getDisplayValues();
    
    // Detectar si la fila 1 contiene la columna antigua "Piloto"
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

    for (var c = 0; c < headers.length; c++) {
      var hName = String(headers[c] || '').trim().toLowerCase();
      if (hName === "piloto" || hName === "conductor" || hName === "chofer") {
        tieneColumnaPiloto = true;
        break;
      }
    }

    if (tieneColumnaPiloto) {
      // Formato antiguo de 20 columnas donde col 6 (G) era Piloto
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
      
      // 📞 Teléfono: Leer exactamente como texto (sin modificarlo ni reordenarlo)
      var tel = String(rowDisp[4] || row[4] || '').trim();
      if (tel.indexOf("'") === 0) {
        tel = tel.substring(1).trim();
      }

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
        quantity: Number(row[idxCantidad]) || 1
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
// 📤 doPost: GUARDAR, ACTUALIZAR ESTADOS (SIN DUPLICAR) Y FLUSH INMEDIATO
// -------------------------------------------------------------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Bloqueo de concurrencia para evitar escrituras simultáneas duplicadas
    try { lock.waitLock(15000); } catch(lErr) {}

    var rawData = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var d = JSON.parse(rawData);
    var sheet = obtenerHojaReclamos();
    
    var accion = String(d.action || d.metodo || d.tipo || '').toLowerCase();
    var idReclamo = String(d.id || d.ID_Reclamo || d.idReclamo || d.voucherNumber || '').trim();
    var esActualizacion = (accion === "actualizar" || accion === "modificar" || accion === "patch" || d.esActualizacion === true);
    
    // 🗑️ ACCIÓN: ELIMINAR TODO EL HISTORIAL (Solo Admin)
    if (accion === "limpiartodo") {
      var lr = sheet.getLastRow();
      if (lr >= 2) {
        sheet.deleteRows(2, lr - 1);
      }
      SpreadsheetApp.flush(); // Guardado inmediato
      try { lock.releaseLock(); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Historial limpiado" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 🗑️ ACCIÓN: ELIMINAR UN RECLAMO ESPECÍFICO (Solo Admin)
    if (accion === "eliminar" || accion === "borrar" || accion === "delete") {
      var filaDel = buscarFilaPorIdONumero(sheet, idReclamo, d.factura);
      if (filaDel !== -1) {
        sheet.deleteRow(filaDel);
        SpreadsheetApp.flush(); // Guardado inmediato
        try { lock.releaseLock(); } catch(e) {}
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Reclamo eliminado", id: idReclamo }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      try { lock.releaseLock(); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "No encontrado" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 📞 TELÉFONO: Forzar como TEXTO PURO con apóstrofe inicial para que Sheets NUNCA lo altere ni ordene como número
    var telRaw = d.telefono != null ? d.telefono : (d.Telefono != null ? d.Telefono : (d.clientPhone != null ? d.clientPhone : ''));
    var telTexto = String(telRaw).trim();
    if (telTexto.indexOf("'") === 0) {
      telTexto = telTexto.substring(1).trim();
    }
    var telParaHoja = telTexto ? ("'" + telTexto) : "";

    var direccion = String(d.direccion || d.Direccion || d["Dirección"] || d.direccionCliente || d["Dirección del Cliente"] || d.clientAddress || '').trim();
    var rawCant = d.cantidad ?? d.Cantidad ?? d.cantidadProducto ?? d["Cantidad de Producto"] ?? d.quantity ?? 1;
    var cantidad = (isNaN(Number(rawCant)) || Number(rawCant) <= 0) ? 1 : Number(rawCant);

    // Detectar si la hoja existente tiene la columna antigua "Piloto"
    var numCols = Math.max(sheet.getLastColumn(), 19);
    var headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var tieneColumnaPiloto = false;
    for (var c = 0; c < headers.length; c++) {
      var hName = String(headers[c] || '').trim().toLowerCase();
      if (hName === "piloto" || hName === "conductor" || hName === "chofer") {
        tieneColumnaPiloto = true;
        break;
      }
    }

    var filaValores;
    if (tieneColumnaPiloto) {
      // Si la hoja aún tiene columna Piloto, se guarda vacía "" para no alterar el orden existente
      filaValores = [
        idReclamo,
        d.ruta || d.Ruta || "",
        d.vendedor || d.Vendedor || "",
        d.cliente || d.Cliente || "",
        telParaHoja, // Columna E: Teléfono estrictamente como TEXTO
        d.factura || d.Factura || "",
        "", // Columna Piloto / Conductor ELIMINADA (queda en blanco)
        d.photo || d.foto || d.Photo || "",
        d.producto || d.Producto || "",
        d.motivo || d.Motivo || "",
        d.fecha || d.Fecha || "",
        d.hora || d.Hora || "",
        d.firmaVendedor || d.FirmaVendedor || "",
        d.firmaCliente || d.FirmaCliente || "",
        d.procesoAceptado || d["Proceso Aceptado"] || "NO",
        d.procesoRechazado || d["Proceso Rechazado"] || "NO",
        d.enProcesoEntrega || d["En Proceso de Entrega"] || "NO",
        d.cambioEntregado || d["Cambio Entregado"] || "NO",
        direccion,
        cantidad
      ];
    } else {
      // Estructura oficial limpia de 19 columnas (SIN campo Piloto)
      filaValores = [
        idReclamo,
        d.ruta || d.Ruta || "",
        d.vendedor || d.Vendedor || "",
        d.cliente || d.Cliente || "",
        telParaHoja, // Columna E: Teléfono estrictamente como TEXTO
        d.factura || d.Factura || "",
        d.photo || d.foto || d.Photo || "",
        d.producto || d.Producto || "",
        d.motivo || d.Motivo || "",
        d.fecha || d.Fecha || "",
        d.hora || d.Hora || "",
        d.firmaVendedor || d.FirmaVendedor || "",
        d.firmaCliente || d.FirmaCliente || "",
        d.procesoAceptado || d["Proceso Aceptado"] || "NO",
        d.procesoRechazado || d["Proceso Rechazado"] || "NO",
        d.enProcesoEntrega || d["En Proceso de Entrega"] || "NO",
        d.cambioEntregado || d["Cambio Entregado"] || "NO",
        direccion,
        cantidad
      ];
    }
    
    // 🔍 BUSCAR SI EXISTE POR NÚMERO O POR ID
    var filaExistente = buscarFilaPorIdONumero(sheet, idReclamo, d.factura);
    
    if (filaExistente !== -1) {
      // ✏️ ACTUALIZAR FILA QUE YA EXISTE EN SU POSICIÓN EXACTA (NUNCA CREAR DUPLICADO)
      sheet.getRange(filaExistente, 1, 1, filaValores.length).setValues([filaValores]);
      sheet.getRange(filaExistente, 5).setNumberFormat("@"); // Asegurar formato texto en teléfono
      SpreadsheetApp.flush(); // ⚡ Guardar al instante en Google Sheets
      try { lock.releaseLock(); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: "actualizado",
        fila: filaExistente,
        id: idReclamo
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (esActualizacion) {
      // 🚫 SI ES ACTUALIZACIÓN DE ESTADO Y NO SE ENCONTRÓ: NUNCA CREAR FILA NUEVA
      SpreadsheetApp.flush();
      try { lock.releaseLock(); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "No se encontró fila para actualizar el estado. Se evitó la creación de duplicados.",
        id: idReclamo
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 🆕 REGISTRO NUEVO
      sheet.appendRow(filaValores);
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 5).setNumberFormat("@"); // Columna E: Teléfono como texto
      SpreadsheetApp.flush(); // ⚡ Guardar al instante en Google Sheets
      try { lock.releaseLock(); } catch(e) {}
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: "creado",
        fila: lastRow,
        id: idReclamo
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (err) {
    try { lock.releaseLock(); } catch(e) {}
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
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
