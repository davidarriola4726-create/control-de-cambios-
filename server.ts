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

function getClaims(): any[] {
  try {
    const raw = fs.readFileSync(claimsFile, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const deleted = getDeletedIds();
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const c of list) {
      const cid = String(c.id || '').trim().toLowerCase();
      const cv = String(c.voucherNumber || '').trim().toLowerCase();
      if ((cid && deleted.has(cid)) || (cv && deleted.has(cv))) continue;
      const key = cid || cv;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduplicated.push(c);
    }
    return deduplicated;
  } catch (err) {
    return [];
  }
}

function saveClaims(claims: any[]) {
  try {
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const c of claims) {
      const key = String(c.id || c.voucherNumber || '').trim().toLowerCase();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduplicated.push(c);
    }
    fs.writeFileSync(claimsFile, JSON.stringify(deduplicated, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving claims:', err);
  }
}

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbwBNgwKl7EOyAZBpyBpAe_B4eIpZLwkpRtWyGLzyPEE8eJf1ofHxbKu9P2zaKMH2lh1_Q/exec";

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
    const data: any = await resp.json();
    const items = Array.isArray(data) ? data : (data?.reclamos || data?.records || data?.data || []);
    
    if (Array.isArray(items) && items.length > 0) {
      let claims = getClaims();
      const deletedIds = getDeletedIds();
      let huboCambios = false;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
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
          const cid = String(c.id || '').trim().toLowerCase();
          const cv = String(c.voucherNumber || '').trim().toLowerCase();
          return (cid && cid === idNorm) || (cv && cv === idNorm);
        });
        
        const aceptado = item.procesoAceptado === 'SI' || item['Proceso Aceptado'] === 'SI' || item.Aceptado === 'SI';
        const rechazado = item.procesoRechazado === 'SI' || item['Proceso Rechazado'] === 'SI' || item.Rechazado === 'SI';
        const enEntrega = item.enProcesoEntrega === 'SI' || item['En Proceso de Entrega'] === 'SI' || item.EnEntrega === 'SI';
        const entregado = String(item.cambioEntregado || item['Cambio Entregado'] || item.Entregado || '').includes('SI');
        const recibido = item.productoRecibido === 'SI' || item['Producto Recibido'] === 'SI' || item.Recibido === 'SI';
        const firmaV = item.firmaVendedor || item.FirmaVendedor || item['Firma Vendedor'] || '';
        const firmaC = item.firmaCliente || item.FirmaCliente || item['Firma Cliente'] || '';

        // Campos nuevos: Dirección del Cliente (Columna S) y Cantidad de Producto (Columna T)
        const direccion = String(item.direccion || item.Direccion || item['Dirección'] || item.direccionCliente || item['Dirección del Cliente'] || item['Direccion del Cliente'] || item.clientAddress || '').trim();
        const rawCant = item.cantidad ?? item.Cantidad ?? item.cantidadProducto ?? item['Cantidad de Producto'] ?? item.quantity ?? 1;
        const cantidad = (isNaN(Number(rawCant)) || Number(rawCant) <= 0) ? 1 : Number(rawCant);

        if (index === -1) {
          // Registro nuevo en Google Sheets no existente localmente
          claims.push({
            id: id,
            voucherNumber: id,
            ruta: item.ruta || item.Ruta || 'Ruta 1',
            vendedor: item.vendedor || item.Vendedor || '',
            piloto: item.piloto || item.Piloto || item.vendedor || '',
            cliente: item.cliente || item.Cliente || '',
            direccion: direccion,
            clientAddress: direccion,
            telefono: item.telefono || item.Telefono || '',
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
            fechaCambioEntregado: item.fechaCambioEntregado || item['Fecha Cambio Entregado'] || ''
          });
          huboCambios = true;
        } else {
          // Actualizar datos y estados si cambiaron
          const actual = claims[index];
          if (actual.procesoAceptado !== aceptado || 
              actual.procesoRechazado !== rechazado || 
              actual.enProcesoEntrega !== enEntrega || 
              actual.cambioEntregado !== entregado || 
              actual.productoRecibido !== recibido ||
              (!actual.firmaCliente && firmaC) ||
              (!actual.direccion && direccion) ||
              (!actual.cantidad && cantidad)) {
            actual.procesoAceptado = aceptado;
            actual.procesoRechazado = rechazado;
            actual.enProcesoEntrega = enEntrega;
            actual.cambioEntregado = entregado;
            actual.productoRecibido = recibido;
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
            huboCambios = true;
          }
        }
      }

      // Asegurar deduplicación estricta por ID
      const claimsMap = new Map<string, any>();
      claims.forEach((c: any) => {
        const idKey = String(c.id || c.voucherNumber || '').trim().toLowerCase();
        if (idKey && !deletedIds.has(idKey)) {
          if (claimsMap.has(idKey)) {
            const anterior = claimsMap.get(idKey);
            claimsMap.set(idKey, { ...anterior, ...c });
            huboCambios = true;
          } else {
            claimsMap.set(idKey, c);
          }
        }
      });
      claims = Array.from(claimsMap.values());

      if (huboCambios) {
        saveClaims(claims);
        console.log(`[GoogleSheets Sync] Sincronización completada con éxito desde Google Sheets`);
      }
    }
  } catch (err) {
    console.warn('[GoogleSheets Sync] Error leyendo Google Sheets:', err);
  }
}

// Ejecutar sincronización al inicio y periódicamente cada 2.5 segundos
setTimeout(sincronizarDesdeGoogleSheets, 1000);
setInterval(sincronizarDesdeGoogleSheets, 2500);

// API Routes
app.get('/api/records', (req, res) => {
  const claims = getClaims();
  res.json(claims);
});

app.post('/api/records', (req, res) => {
  let claims = getClaims();
  const record = req.body;
  if (!record.id) {
    record.id = 'N° ' + String(claims.length + 1).padStart(5, '0');
  }
  const idNorm = String(record.id).trim().toLowerCase();

  // Buscar si ya existe por ID o voucherNumber para ACTUALIZAR en vez de duplicar
  const existingIdx = claims.findIndex((c: any) => {
    const cid = String(c.id || '').trim().toLowerCase();
    const cv = String(c.voucherNumber || '').trim().toLowerCase();
    return cid === idNorm || cv === idNorm;
  });

  const direccion = String(record.direccion || record.direccionCliente || record.clientAddress || "").trim();
  const rawCant = record.cantidad ?? record.cantidadProducto ?? record.quantity ?? 1;
  const cantidad = (isNaN(Number(rawCant)) || Number(rawCant) <= 0) ? 1 : Number(rawCant);

  if (existingIdx !== -1) {
    // ACTUALIZAR registro existente para no crear duplicados
    claims[existingIdx] = {
      ...claims[existingIdx],
      ...record,
      id: claims[existingIdx].id || record.id,
      direccion: direccion || claims[existingIdx].direccion || "",
      clientAddress: direccion || claims[existingIdx].clientAddress || "",
      cantidad: cantidad || claims[existingIdx].cantidad || 1,
      quantity: cantidad || claims[existingIdx].quantity || 1
    };
    saveClaims(claims);

    enviarAGoogleSheetsConReintentos({
      action: "actualizar",
      metodo: "actualizar",
      hoja: "RECLAMOS",
      id: claims[existingIdx].id,
      ID_Reclamo: claims[existingIdx].id,
      ...claims[existingIdx],
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
      quantity: claims[existingIdx].cantidad
    });

    return res.json(claims[existingIdx]);
  }

  const nuevo = {
    ...record,
    direccion,
    clientAddress: direccion,
    cantidad,
    quantity: cantidad
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
    telefono: nuevo.telefono || nuevo.clientPhone || "",
    Telefono: nuevo.telefono || nuevo.clientPhone || "",
    factura: nuevo.factura,
    Factura: nuevo.factura,
    piloto: nuevo.piloto || nuevo.vendedor,
    Piloto: nuevo.piloto || nuevo.vendedor,
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
    quantity: nuevo.cantidad
  });

  res.status(201).json(nuevo);
});

app.put('/api/records/:id', (req, res) => {
  const rawId = decodeURIComponent(req.params.id).trim();
  const idNorm = rawId.toLowerCase();
  const updatedData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => {
    const cid = String(c.id || '').trim().toLowerCase();
    const cv = String(c.voucherNumber || '').trim().toLowerCase();
    return cid === idNorm || cv === idNorm;
  });

  const direccion = String(updatedData.direccion || updatedData.direccionCliente || updatedData.clientAddress || "").trim();
  const rawCant = updatedData.cantidad ?? updatedData.cantidadProducto ?? updatedData.quantity;
  const cantidad = (rawCant !== undefined && !isNaN(Number(rawCant)) && Number(rawCant) > 0) ? Number(rawCant) : undefined;

  if (index !== -1) {
    claims[index] = {
      ...claims[index],
      ...updatedData,
      id: claims[index].id || rawId,
      direccion: direccion || claims[index].direccion || "",
      clientAddress: direccion || claims[index].clientAddress || "",
      cantidad: cantidad !== undefined ? cantidad : (claims[index].cantidad || 1),
      quantity: cantidad !== undefined ? cantidad : (claims[index].quantity || 1)
    };
    saveClaims(claims);

    // Sincronizar actualización con Google Sheets
    enviarAGoogleSheetsConReintentos({
      action: "actualizar",
      metodo: "actualizar",
      hoja: "RECLAMOS",
      id: claims[index].id,
      ID_Reclamo: claims[index].id,
      ...claims[index],
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
      quantity: claims[index].cantidad
    });

    res.json(claims[index]);
  } else {
    const nuevo = {
      ...updatedData,
      id: rawId,
      direccion: direccion || "",
      cantidad: cantidad || 1
    };
    claims.unshift(nuevo);
    saveClaims(claims);
    enviarAGoogleSheetsConReintentos({
      action: "guardar",
      hoja: "RECLAMOS",
      id: rawId,
      ID_Reclamo: rawId,
      ...nuevo
    });
    res.status(201).json(nuevo);
  }
});

app.patch('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const patchData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => c.id === id || c.voucherNumber === id);
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
    const cId = String(c.id || '').trim().toLowerCase();
    const cVoucher = String(c.voucherNumber || '').trim().toLowerCase();
    return cId !== idNorm && cVoucher !== idNorm;
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
