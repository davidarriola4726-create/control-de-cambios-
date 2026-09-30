import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const claimsFile = path.join(dataDir, 'claims.json');
if (!fs.existsSync(claimsFile)) {
  fs.writeFileSync(claimsFile, JSON.stringify([], null, 2), 'utf8');
}

const deletedFile = path.join(dataDir, 'deleted_ids.json');
if (!fs.existsSync(deletedFile)) {
  fs.writeFileSync(deletedFile, JSON.stringify([], null, 2), 'utf8');
}

function getDeletedIds(): Set<string> {
  try {
    if (fs.existsSync(deletedFile)) {
      const raw = fs.readFileSync(deletedFile, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return new Set(list.map(x => String(x).trim().toLowerCase()));
      }
    }
  } catch (e) {
    console.error('Error reading deleted_ids:', e);
  }
  return new Set<string>();
}

function saveDeletedIds(ids: Set<string>) {
  try {
    fs.writeFileSync(deletedFile, JSON.stringify(Array.from(ids), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving deleted_ids:', err);
  }
}

function extraerNumeroReclamo(val: any): number {
  if (!val) return 0;
  const s = String(val).trim();
  const m = s.match(/(?:N[°º\.]?|#|\b)\s*(\d+)/i);
  if (m) {
    const num = parseInt(m[1], 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function sonElMismoReclamo(idA: any, idB: any): boolean {
  if (!idA || !idB) return false;
  const sa = String(idA).trim().toLowerCase();
  const sb = String(idB).trim().toLowerCase();
  if (sa === sb) return true;
  const na = extraerNumeroReclamo(idA);
  const nb = extraerNumeroReclamo(idB);
  if (na > 0 && nb > 0 && na === nb) return true;
  return false;
}

const VENDEDORES_POR_RUTA: Record<string, string> = {
  "Ruta 1": "BRYAN GOMEZ",
  "Ruta 2": "MELVIN SEQUEN",
  "Ruta 3": "MARVIN GOMEZ",
  "Ruta 4": "MARCOS JUAREZ",
  "Ruta 5": "KENEDY BATZ",
  "Ruta 6": "GUSTAVO GOMEZ",
  "Ruta 7": "GUILLERMO ESPAÑA",
  "Ruta 8": "MARVIN OTONIEL",
  "Ruta 9": "SERGIO CATU",
  "Ruta 10": "EDGAR GUZMAN",
  "Ruta 11": "ESAU OSORIO"
};

function normalizarARutaId(rutaVal: any, vendedorVal: any): string {
  const str = `${rutaVal || ''} ${vendedorVal || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Ruta 11 - ESAU OSORIO
  if (str.includes("11") || str.includes("esau") || str.includes("osorio")) return "Ruta 11";
  // Ruta 10 - EDGAR GUZMAN
  if (str.includes("10") || str.includes("edgar") || str.includes("guzman")) return "Ruta 10";
  // Ruta 9 - SERGIO CATU
  if (str.includes("9") || str.includes("sergio") || str.includes("catu")) return "Ruta 9";
  // Ruta 8 - MARVIN OTONIEL
  if (str.includes("8") || str.includes("otoniel")) return "Ruta 8";
  // Ruta 7 - GUILLERMO ESPAÑA
  if (str.includes("7") || str.includes("guillermo") || str.includes("espana")) return "Ruta 7";
  // Ruta 6 - GUSTAVO GOMEZ
  if (str.includes("6") || str.includes("gustavo")) return "Ruta 6";
  // Ruta 5 - KENEDY BATZ
  if (str.includes("5") || str.includes("kenedy") || str.includes("batz")) return "Ruta 5";
  // Ruta 4 - MARCOS JUAREZ
  if (str.includes("4") || str.includes("marcos") || str.includes("juarez")) return "Ruta 4";
  // Ruta 3 - MARVIN GOMEZ
  if (str.includes("3") || (str.includes("marvin") && !str.includes("otoniel"))) return "Ruta 3";
  // Ruta 2 - MELVIN SEQUEN
  if (str.includes("2") || str.includes("melvin") || str.includes("sequen")) return "Ruta 2";
  // Ruta 1 - BRYAN GOMEZ
  if (str.includes("1") || str.includes("bryan") || str.includes("brayan")) return "Ruta 1";
  
  const m = str.match(/ruta\s*[-_]?\s*(\d+)/i);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 11) return `Ruta ${num}`;
  }

  return "Ruta 1";
}

function esReclamoValido(c: any): boolean {
  if (!c) return false;
  const cliente = String(c.cliente || c.Cliente || c.clientName || '').trim();
  const producto = String(c.producto || c.Producto || c.productName || '').trim();
  const factura = String(c.factura || c.Factura || c.invoiceNumber || '').trim();
  const motivo = String(c.motivo || c.Motivo || c.description || '').trim();
  return Boolean(cliente || producto || factura || motivo);
}

function getClaims(): any[] {
  try {
    const raw = fs.readFileSync(claimsFile, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const deleted = getDeletedIds();
    const seenIds = new Set<string>();
    const seenNums = new Set<number>();
    const deduplicated: any[] = [];
    for (const c of list) {
      if (!esReclamoValido(c)) continue;
      const cid = String(c.id || '').trim().toLowerCase();
      const cv = String(c.voucherNumber || '').trim().toLowerCase();
      const num = extraerNumeroReclamo(c.id || c.voucherNumber);
      if ((cid && deleted.has(cid)) || (cv && deleted.has(cv))) continue;
      const key = cid || cv;
      if (key && seenIds.has(key)) continue;
      if (num > 0 && seenNums.has(num)) continue;
      if (key) seenIds.add(key);
      if (num > 0) seenNums.add(num);

      // Normalizar ruta canónica y vendedor exacto
      c.ruta = normalizarARutaId(c.ruta, c.vendedor);
      if (!c.vendedor || c.vendedor.trim() === '' || c.vendedor.toLowerCase() === 'administrador general') {
        c.vendedor = VENDEDORES_POR_RUTA[c.ruta] || c.vendedor;
      }

      deduplicated.push(c);
    }
    return deduplicated;
  } catch (err) {
    return [];
  }
}

function saveClaims(claims: any[]) {
  try {
    const seenIds = new Set<string>();
    const seenNums = new Set<number>();
    const deduplicated: any[] = [];
    for (const c of claims) {
      if (!esReclamoValido(c)) continue;
      const key = String(c.id || c.voucherNumber || '').trim().toLowerCase();
      const num = extraerNumeroReclamo(c.id || c.voucherNumber);
      if (key && seenIds.has(key)) continue;
      if (num > 0 && seenNums.has(num)) continue;
      if (key) seenIds.add(key);
      if (num > 0) seenNums.add(num);

      c.ruta = normalizarARutaId(c.ruta, c.vendedor);
      if (!c.vendedor || c.vendedor.trim() === '' || c.vendedor.toLowerCase() === 'administrador general') {
        c.vendedor = VENDEDORES_POR_RUTA[c.ruta] || c.vendedor;
      }

      deduplicated.push(c);
    }
    fs.writeFileSync(claimsFile, JSON.stringify(deduplicated, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving claims:', err);
  }
}

function limpiarTelefonoTexto(val: any): string {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (s.startsWith("'")) s = s.substring(1).trim();
  return s;
}

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxTs9AoIJjwII3K5KcMGzhJAIFzF-Fias43rCWB6VxXx8Dvi3Tc3rygQwEn9A47E7uOSg/exec";

// Reintentar envío a Google Sheets en segundo plano
async function enviarAGoogleSheetsConReintentos(payload: any, maxRetries = 3) {
  for (let intento = 1; intento <= maxRetries; intento++) {
    try {
      const resp = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        console.log(`[GoogleSheets Sync] Éxito al sincronizar ${payload.id || payload.ID_Reclamo || 'registro'}`);
        return true;
      }
    } catch (err) {
      console.warn(`[GoogleSheets Sync] Intento ${intento}/${maxRetries} falló:`, err);
      if (intento < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * intento));
      }
    }
  }
  console.error(`[GoogleSheets Sync] No se pudo sincronizar tras ${maxRetries} intentos`);
  return false;
}

// Sincronizar lectura desde Google Sheets hacia el servidor local
async function sincronizarDesdeGoogleSheets() {
  try {
    const resp = await fetch(GOOGLE_SHEETS_URL);
    if (!resp.ok) return;
    const cType = resp.headers.get('content-type') || '';
    if (!cType.includes('json') && !cType.includes('javascript') && !cType.includes('text/plain')) {
      // Si devolvió HTML (ej. página de inicio de sesión de Google o 404), ignorar
      return;
    }
    const rawText = await resp.text();
    if (!rawText || !rawText.trim().startsWith('{') && !rawText.trim().startsWith('[')) {
      return;
    }
    const data: any = JSON.parse(rawText);
    const items = Array.isArray(data) ? data : (data?.reclamos || data?.records || data?.data || []);
    
    if (Array.isArray(items) && items.length > 0) {
      let claims = getClaims();
      const deletedIds = getDeletedIds();
      let huboCambios = false;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if (!esReclamoValido(item)) {
          continue; // Omitir filas vacías o de ejemplo
        }

        let rawId = String(item.idReclamo || item.ID_Reclamo || item.id || item.ID || item.voucherNumber || '').trim();
        if (rawId && rawId.startsWith("REC-F") && item.factura && rawId === `REC-F${item.factura}`) {
          rawId = '';
        }
        let id = rawId;
        if (!id) {
          // Buscar si existe un reclamo con la misma factura o en la misma posición para preservar su ID exacto
          const existentePorFactura = item.factura ? claims.find((c: any) => c.factura && String(c.factura).trim() === String(item.factura).trim()) : null;
          if (existentePorFactura) {
            id = existentePorFactura.id;
          } else if (claims[idx] && claims[idx].id) {
            id = claims[idx].id;
          } else {
            id = `N° ${String(idx + 1).padStart(5, '0')}`;
          }
        }
        const idNorm = id.trim().toLowerCase();

        // Si fue eliminado por el administrador, NUNCA volver a añadirlo ni duplicarlo
        if (deletedIds.has(idNorm)) {
          continue;
        }

        const index = claims.findIndex((c: any) => {
          return sonElMismoReclamo(c.id, id) || sonElMismoReclamo(c.voucherNumber, id);
        });
        
        const aceptado = item.procesoAceptado === 'SI' || item['Proceso Aceptado'] === 'SI' || item.Aceptado === 'SI';
        const rechazado = item.procesoRechazado === 'SI' || item['Proceso Rechazado'] === 'SI' || item.Rechazado === 'SI';
        const enEntrega = item.enProcesoEntrega === 'SI' || item['En Proceso de Entrega'] === 'SI' || item.EnEntrega === 'SI';
        const entregado = String(item.cambioEntregado || item['Cambio Entregado'] || item.Entregado || '').includes('SI');
        const recibido = item.productoRecibido === 'SI' || item['Producto Recibido'] === 'SI' || item.Recibido === 'SI';
        const firmaV = item.firmaVendedor || item.FirmaVendedor || item['Firma Vendedor'] || '';
        const firmaC = item.firmaCliente || item.FirmaCliente || item['Firma Cliente'] || '';

        // Campos: Dirección del Cliente (Columna S) y Cantidad de Producto (Columna T)
        const direccion = String(item.direccion || item.Direccion || item['Dirección'] || item.direccionCliente || item['Dirección del Cliente'] || item['Direccion del Cliente'] || item.clientAddress || '').trim();
        const rawCant = item.cantidad ?? item.Cantidad ?? item.cantidadProducto ?? item['Cantidad de Producto'] ?? item.quantity ?? 1;
        const cantidad = (isNaN(Number(rawCant)) || Number(rawCant) <= 0) ? 1 : Number(rawCant);
        const tel = limpiarTelefonoTexto(item.telefono || item.Telefono || item.clientPhone || '');

        // Casillas de verificación: Cambio (Col T), Devolución (Col U), Reparación (Col V)
        const esCambio = item.cambio === true || String(item.cambio || item.Cambio || '').trim().toUpperCase() === 'SI' || String(item.cambio || item.Cambio || '').trim().toLowerCase() === 'true';
        const esDevolucion = item.devolucion === true || String(item.devolucion || item.Devolucion || item['Devolución'] || '').trim().toUpperCase() === 'SI' || String(item.devolucion || item.Devolucion || item['Devolución'] || '').trim().toLowerCase() === 'true';
        const esReparacion = item.reparacion === true || String(item.reparacion || item.Reparacion || item['Reparación'] || '').trim().toUpperCase() === 'SI' || String(item.reparacion || item.Reparacion || item['Reparación'] || '').trim().toLowerCase() === 'true';

        const rutaCanon = normalizarARutaId(item.ruta || item.Ruta, item.vendedor || item.Vendedor);
        const vendedorCanon = String(item.vendedor || item.Vendedor || VENDEDORES_POR_RUTA[rutaCanon] || '').trim();

        if (index === -1) {
          // Registro nuevo en Google Sheets no existente localmente
          claims.push({
            id: id,
            voucherNumber: id,
            ruta: rutaCanon,
            vendedor: vendedorCanon,
            cliente: item.cliente || item.Cliente || '',
            direccion: direccion,
            clientAddress: direccion,
            telefono: tel,
            clientPhone: tel,
            factura: item.factura || item.Factura || '',
            producto: item.producto || item.Producto || '',
            cantidad: cantidad,
            quantity: cantidad,
            motivo: item.motivo || item.Motivo || '',
            fecha: item.fecha ? String(item.fecha).split('T')[0] : (item.Fecha || ''),
            hora: item.hora ? String(item.hora).split('T')[1]?.slice(0, 5) || String(item.hora) : (item.Hora || ''),
            firmaVendedor: firmaV,
            firmaCliente: firmaC,
            procesoAceptado: aceptado,
            procesoRechazado: rechazado,
            enProcesoEntrega: enEntrega,
            cambioEntregado: entregado,
            productoRecibido: recibido,
            fechaCambioEntregado: item.fechaCambioEntregado || item['Fecha Cambio Entregado'] || '',
            cambio: esCambio,
            devolucion: esDevolucion,
            reparacion: esReparacion
          });
          huboCambios = true;
        } else {
          // Actualizar datos y estados si cambiaron
          const actual = claims[index];
          actual.ruta = rutaCanon;
          if (vendedorCanon) actual.vendedor = vendedorCanon;
          if (actual.procesoAceptado !== aceptado || 
              actual.procesoRechazado !== rechazado || 
              actual.enProcesoEntrega !== enEntrega || 
              actual.cambioEntregado !== entregado || 
              actual.productoRecibido !== recibido ||
              actual.cambio !== esCambio ||
              actual.devolucion !== esDevolucion ||
              actual.reparacion !== esReparacion ||
              (!actual.firmaCliente && firmaC) ||
              (!actual.direccion && direccion) ||
              (!actual.cantidad && cantidad) ||
              (tel && actual.telefono !== tel)) {
            actual.procesoAceptado = aceptado;
            actual.procesoRechazado = rechazado;
            actual.enProcesoEntrega = enEntrega;
            actual.cambioEntregado = entregado;
            actual.productoRecibido = recibido;
            actual.cambio = esCambio;
            actual.devolucion = esDevolucion;
            actual.reparacion = esReparacion;
            if (firmaC) actual.firmaCliente = firmaC;
            if (firmaV) actual.firmaVendedor = firmaV;
            if (direccion) {
              actual.direccion = direccion;
              actual.clientAddress = direccion;
            }
            if (cantidad) {
              actual.cantidad = cantidad;
              actual.quantity = cantidad;
            }
            if (tel) {
              actual.telefono = tel;
              actual.clientPhone = tel;
            }
            huboCambios = true;
          }
        }
      }

      // Asegurar deduplicación estricta por ID y número
      const claimsDeduplicados: any[] = [];
      claims.forEach((c: any) => {
        const idKey = String(c.id || c.voucherNumber || '').trim().toLowerCase();
        if (idKey && !deletedIds.has(idKey)) {
          const idx = claimsDeduplicados.findIndex((x: any) => sonElMismoReclamo(x.id, c.id) || sonElMismoReclamo(x.voucherNumber, c.voucherNumber));
          if (idx !== -1) {
            claimsDeduplicados[idx] = { ...claimsDeduplicados[idx], ...c };
            huboCambios = true;
          } else {
            claimsDeduplicados.push(c);
          }
        }
      });
      claims = claimsDeduplicados;

      if (huboCambios) {
        saveClaims(claims);
        console.log(`[GoogleSheets Sync] Sincronización completada con éxito desde Google Sheets`);
      }
    }
  } catch (err) {
    console.warn('[GoogleSheets Sync] Error leyendo Google Sheets:', err);
  }
}

// Ejecutar sincronización al inicio y periódicamente cada 3 segundos (tiempo real)
setTimeout(sincronizarDesdeGoogleSheets, 1000);
setInterval(sincronizarDesdeGoogleSheets, 3000);

// API Routes
app.get('/api/records', (req, res) => {
  const claims = getClaims();
  res.json(claims);
});

app.post('/api/records', (req, res) => {
  let claims = getClaims();
  const record = req.body;
  if (!esReclamoValido(record)) {
    return res.status(400).json({ error: "Reclamo inválido: requiere cliente, producto o factura" });
  }

  const rutaCanon = normalizarARutaId(record.ruta, record.vendedor);
  const vendedorCanon = (record.vendedor && record.vendedor.trim() !== '' && record.vendedor.toLowerCase() !== 'administrador general') 
    ? record.vendedor 
    : (VENDEDORES_POR_RUTA[rutaCanon] || 'BRYAN GOMEZ');

  record.ruta = rutaCanon;
  record.vendedor = vendedorCanon;

  if (!record.id) {
    record.id = 'N° ' + String(claims.length + 1).padStart(5, '0');
  }

  // Buscar si ya existe por ID o número para ACTUALIZAR en vez de duplicar
  const existingIdx = claims.findIndex((c: any) => {
    return sonElMismoReclamo(c.id, record.id) || sonElMismoReclamo(c.voucherNumber, record.id);
  });

  const direccion = String(record.direccion || record.direccionCliente || record.clientAddress || "").trim();
  const rawCant = record.cantidad ?? record.cantidadProducto ?? record.quantity ?? 1;
  const cantidad = (isNaN(Number(rawCant)) || Number(rawCant) <= 0) ? 1 : Number(rawCant);
  const tel = limpiarTelefonoTexto(record.telefono || record.clientPhone || "");

  if (existingIdx !== -1) {
    // ACTUALIZAR registro existente para no crear duplicados
    claims[existingIdx] = {
      ...claims[existingIdx],
      ...record,
      id: claims[existingIdx].id || record.id,
      direccion: direccion || claims[existingIdx].direccion || "",
      clientAddress: direccion || claims[existingIdx].clientAddress || "",
      telefono: tel || claims[existingIdx].telefono || "",
      clientPhone: tel || claims[existingIdx].clientPhone || "",
      cantidad: cantidad || claims[existingIdx].cantidad || 1,
      quantity: cantidad || claims[existingIdx].quantity || 1
    };
    saveClaims(claims);

    enviarAGoogleSheetsConReintentos({
      action: "actualizar",
      metodo: "actualizar",
      esActualizacion: true,
      hoja: "RECLAMOS",
      id: claims[existingIdx].id,
      ID_Reclamo: claims[existingIdx].id,
      ...claims[existingIdx],
      telefono: tel || claims[existingIdx].telefono || "",
      Telefono: tel || claims[existingIdx].telefono || "",
      // Columna S: Dirección del Cliente
      direccion: claims[existingIdx].direccion,
      Direccion: claims[existingIdx].direccion,
      "Dirección": claims[existingIdx].direccion,
      "Dirección del Cliente": claims[existingIdx].direccion,
      "Direccion del Cliente": claims[existingIdx].direccion,
      clientAddress: claims[existingIdx].direccion,
      // Columna T: Cantidad de Producto
      cantidad: claims[existingIdx].cantidad,
      Cantidad: claims[existingIdx].cantidad,
      cantidadProducto: claims[existingIdx].cantidad,
      "Cantidad de Producto": claims[existingIdx].cantidad,
      quantity: claims[existingIdx].cantidad,
      // Columna T: Cambio
      cambio: claims[existingIdx].cambio ? "SI" : "NO",
      Cambio: claims[existingIdx].cambio ? "SI" : "NO",
      // Columna U: Devolución
      devolucion: claims[existingIdx].devolucion ? "SI" : "NO",
      Devolucion: claims[existingIdx].devolucion ? "SI" : "NO",
      "Devolución": claims[existingIdx].devolucion ? "SI" : "NO",
      // Columna V: Reparación
      reparacion: claims[existingIdx].reparacion ? "SI" : "NO",
      Reparacion: claims[existingIdx].reparacion ? "SI" : "NO",
      "Reparación": claims[existingIdx].reparacion ? "SI" : "NO"
    });

    return res.json(claims[existingIdx]);
  }

  const nuevo = {
    ...record,
    telefono: tel,
    clientPhone: tel,
    direccion,
    clientAddress: direccion,
    cantidad,
    quantity: cantidad,
    cambio: record.cambio === true || record.cambio === 'SI' || record.Cambio === 'SI',
    devolucion: record.devolucion === true || record.devolucion === 'SI' || record.Devolucion === 'SI' || record['Devolución'] === 'SI',
    reparacion: record.reparacion === true || record.reparacion === 'SI' || record.Reparacion === 'SI' || record['Reparación'] === 'SI'
  };
  claims.unshift(nuevo);
  saveClaims(claims);

  // Sincronizar asíncronamente con Google Sheets
  enviarAGoogleSheetsConReintentos({
    action: "guardar",
    hoja: "RECLAMOS",
    id: nuevo.id,
    ID_Reclamo: nuevo.id,
    ruta: nuevo.ruta,
    Ruta: nuevo.ruta,
    vendedor: nuevo.vendedor,
    Vendedor: nuevo.vendedor,
    cliente: nuevo.cliente,
    Cliente: nuevo.cliente,
    telefono: tel,
    Telefono: tel,
    factura: nuevo.factura,
    Factura: nuevo.factura,
    photo: nuevo.photo || nuevo.foto || "",
    foto: nuevo.photo || nuevo.foto || "",
    producto: nuevo.producto,
    Producto: nuevo.producto,
    motivo: nuevo.motivo,
    Motivo: nuevo.motivo,
    fecha: nuevo.fecha,
    Fecha: nuevo.fecha,
    hora: nuevo.hora,
    Hora: nuevo.hora,
    firmaVendedor: nuevo.firmaVendedor || "",
    FirmaVendedor: nuevo.firmaVendedor || "",
    firmaCliente: nuevo.firmaCliente || "",
    FirmaCliente: nuevo.firmaCliente || "",
    procesoAceptado: nuevo.procesoAceptado ? "SI" : "NO",
    "Proceso Aceptado": nuevo.procesoAceptado ? "SI" : "NO",
    procesoRechazado: nuevo.procesoRechazado ? "SI" : "NO",
    "Proceso Rechazado": nuevo.procesoRechazado ? "SI" : "NO",
    enProcesoEntrega: nuevo.enProcesoEntrega ? "SI" : "NO",
    "En Proceso de Entrega": nuevo.enProcesoEntrega ? "SI" : "NO",
    cambioEntregado: nuevo.cambioEntregado ? "SI" : "NO",
    "Cambio Entregado": nuevo.cambioEntregado ? "SI" : "NO",
    productoRecibido: nuevo.productoRecibido ? "SI" : "NO",
    "Producto Recibido": nuevo.productoRecibido ? "SI" : "NO",
    fechaCambioEntregado: nuevo.fechaCambioEntregado || "",
    // Columna S: Dirección del Cliente
    direccion: nuevo.direccion,
    Direccion: nuevo.direccion,
    "Dirección": nuevo.direccion,
    "Dirección del Cliente": nuevo.direccion,
    "Direccion del Cliente": nuevo.direccion,
    clientAddress: nuevo.direccion,
    // Columna T: Cantidad de Producto
    cantidad: nuevo.cantidad,
    Cantidad: nuevo.cantidad,
    cantidadProducto: nuevo.cantidad,
    "Cantidad de Producto": nuevo.cantidad,
    quantity: nuevo.cantidad,
    // Columna T: Cambio
    cambio: nuevo.cambio ? "SI" : "NO",
    Cambio: nuevo.cambio ? "SI" : "NO",
    // Columna U: Devolución
    devolucion: nuevo.devolucion ? "SI" : "NO",
    Devolucion: nuevo.devolucion ? "SI" : "NO",
    "Devolución": nuevo.devolucion ? "SI" : "NO",
    // Columna V: Reparación
    reparacion: nuevo.reparacion ? "SI" : "NO",
    Reparacion: nuevo.reparacion ? "SI" : "NO",
    "Reparación": nuevo.reparacion ? "SI" : "NO"
  });

  res.status(201).json(nuevo);
});

app.put('/api/records/:id', (req, res) => {
  const rawId = decodeURIComponent(req.params.id).trim();
  const updatedData = req.body;
  let claims = getClaims();
  let index = claims.findIndex((c: any) => {
    return sonElMismoReclamo(c.id, rawId) || sonElMismoReclamo(c.voucherNumber, rawId);
  });

  if (index === -1 && updatedData.factura) {
    const factNorm = String(updatedData.factura).trim().toLowerCase();
    index = claims.findIndex((c: any) => c.factura && String(c.factura).trim().toLowerCase() === factNorm);
  }

  const direccion = String(updatedData.direccion || updatedData.direccionCliente || updatedData.clientAddress || "").trim();
  const rawCant = updatedData.cantidad ?? updatedData.cantidadProducto ?? updatedData.quantity;
  const cantidad = (rawCant !== undefined && !isNaN(Number(rawCant)) && Number(rawCant) > 0) ? Number(rawCant) : undefined;
  const tel = limpiarTelefonoTexto(updatedData.telefono || updatedData.clientPhone);

  const cambio = updatedData.cambio !== undefined ? (updatedData.cambio === true || updatedData.cambio === 'SI') : claims[index]?.cambio;
  const devolucion = updatedData.devolucion !== undefined ? (updatedData.devolucion === true || updatedData.devolucion === 'SI') : claims[index]?.devolucion;
  const reparacion = updatedData.reparacion !== undefined ? (updatedData.reparacion === true || updatedData.reparacion === 'SI') : claims[index]?.reparacion;

  if (index !== -1) {
    const rutaNorm = normalizarARutaId(updatedData.ruta || claims[index].ruta, updatedData.vendedor || claims[index].vendedor);
    const vendedorNorm = (updatedData.vendedor && updatedData.vendedor.trim() !== '' && updatedData.vendedor.toLowerCase() !== 'administrador general') 
      ? updatedData.vendedor 
      : (VENDEDORES_POR_RUTA[rutaNorm] || claims[index].vendedor);

    claims[index] = {
      ...claims[index],
      ...updatedData,
      id: claims[index].id || rawId,
      ruta: rutaNorm,
      vendedor: vendedorNorm,
      direccion: direccion || claims[index].direccion || "",
      clientAddress: direccion || claims[index].clientAddress || "",
      telefono: tel || claims[index].telefono || "",
      clientPhone: tel || claims[index].clientPhone || "",
      cantidad: cantidad !== undefined ? cantidad : (claims[index].cantidad || 1),
      quantity: cantidad !== undefined ? cantidad : (claims[index].quantity || 1),
      cambio: !!cambio,
      devolucion: !!devolucion,
      reparacion: !!reparacion
    };
    saveClaims(claims);

    // Sincronizar actualización con Google Sheets (NUNCA crear fila nueva)
    enviarAGoogleSheetsConReintentos({
      action: "actualizar",
      metodo: "actualizar",
      esActualizacion: true,
      hoja: "RECLAMOS",
      id: claims[index].id,
      ID_Reclamo: claims[index].id,
      ...claims[index],
      telefono: claims[index].telefono,
      Telefono: claims[index].telefono,
      // Columna S: Dirección del Cliente
      direccion: claims[index].direccion,
      Direccion: claims[index].direccion,
      "Dirección": claims[index].direccion,
      "Dirección del Cliente": claims[index].direccion,
      "Direccion del Cliente": claims[index].direccion,
      clientAddress: claims[index].direccion,
      // Columna T: Cantidad de Producto
      cantidad: claims[index].cantidad,
      Cantidad: claims[index].cantidad,
      cantidadProducto: claims[index].cantidad,
      "Cantidad de Producto": claims[index].cantidad,
      quantity: claims[index].cantidad,
      // Columna T: Cambio
      cambio: claims[index].cambio ? "SI" : "NO",
      Cambio: claims[index].cambio ? "SI" : "NO",
      // Columna U: Devolución
      devolucion: claims[index].devolucion ? "SI" : "NO",
      Devolucion: claims[index].devolucion ? "SI" : "NO",
      "Devolución": claims[index].devolucion ? "SI" : "NO",
      // Columna V: Reparación
      reparacion: claims[index].reparacion ? "SI" : "NO",
      Reparacion: claims[index].reparacion ? "SI" : "NO",
      "Reparación": claims[index].reparacion ? "SI" : "NO"
    });

    res.json(claims[index]);
  } else {
    // Si no se encontró por ID para actualizar, NUNCA crear fila nueva ni duplicar
    console.warn(`[PUT /api/records/:id] Reclamo ${rawId} no encontrado para actualizar. Fila protegida contra duplicados.`);
    res.status(404).json({ error: 'Record not found for update. Duplicate creation prevented.' });
  }
});

app.patch('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const patchData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => sonElMismoReclamo(c.id, id) || sonElMismoReclamo(c.voucherNumber, id));
  if (index !== -1) {
    claims[index] = { ...claims[index], ...patchData };
    saveClaims(claims);
    res.json(claims[index]);
  } else {
    res.status(404).json({ error: 'Record not found' });
  }
});

app.get('/api/deleted-ids', (req, res) => {
  res.json(Array.from(getDeletedIds()));
});

app.delete('/api/records', (req, res) => {
  const claims = getClaims();
  const deletedIds = getDeletedIds();
  claims.forEach((c: any) => {
    if (c.id) deletedIds.add(String(c.id).trim().toLowerCase());
    if (c.voucherNumber) deletedIds.add(String(c.voucherNumber).trim().toLowerCase());
  });
  saveDeletedIds(deletedIds);
  saveClaims([]);

  enviarAGoogleSheetsConReintentos({
    action: "limpiarTodo",
    hoja: "RECLAMOS"
  });

  res.json({ success: true, count: 0 });
});

app.delete('/api/records/:id', (req, res) => {
  const rawId = decodeURIComponent(req.params.id).trim();
  const idNorm = rawId.toLowerCase();

  const deletedIds = getDeletedIds();
  deletedIds.add(idNorm);
  saveDeletedIds(deletedIds);

  let claims = getClaims();
  claims = claims.filter((c: any) => {
    return !sonElMismoReclamo(c.id, rawId) && !sonElMismoReclamo(c.voucherNumber, rawId);
  });
  saveClaims(claims);

  enviarAGoogleSheetsConReintentos({
    action: "eliminar",
    metodo: "eliminar",
    delete: true,
    hoja: "RECLAMOS",
    id: rawId,
    ID_Reclamo: rawId,
    idReclamo: rawId,
    ID: rawId,
    voucherNumber: rawId
  });

  enviarAGoogleSheetsConReintentos({
    action: "delete",
    hoja: "RECLAMOS",
    id: rawId,
    ID_Reclamo: rawId,
    idReclamo: rawId,
    ID: rawId
  });

  res.json({ success: true, id: rawId });
});

// Serve static assets and index.html
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
