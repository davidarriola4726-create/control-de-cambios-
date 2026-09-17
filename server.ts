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

function getClaims(): any[] {
  try {
    const raw = fs.readFileSync(claimsFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveClaims(claims: any[]) {
  try {
    fs.writeFileSync(claimsFile, JSON.stringify(claims, null, 2), 'utf8');
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
      let huboCambios = false;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const id = String(item.idReclamo || item.ID_Reclamo || item.id || item.ID || '').trim() || (item.factura ? `REC-F${item.factura}` : `REC-${String(idx + 1).padStart(4, '0')}`);
        const index = claims.findIndex((c: any) => (c.id && c.id === id) || (c.voucherNumber && c.voucherNumber === id));
        
        const aceptado = item.procesoAceptado === 'SI' || item['Proceso Aceptado'] === 'SI' || item.Aceptado === 'SI';
        const rechazado = item.procesoRechazado === 'SI' || item['Proceso Rechazado'] === 'SI' || item.Rechazado === 'SI';
        const enEntrega = item.enProcesoEntrega === 'SI' || item['En Proceso de Entrega'] === 'SI' || item.EnEntrega === 'SI';
        const entregado = String(item.cambioEntregado || item['Cambio Entregado'] || item.Entregado || '').includes('SI');
        const recibido = item.productoRecibido === 'SI' || item['Producto Recibido'] === 'SI' || item.Recibido === 'SI';
        const firmaV = item.firmaVendedor || item.FirmaVendedor || item['Firma Vendedor'] || '';
        const firmaC = item.firmaCliente || item.FirmaCliente || item['Firma Cliente'] || '';

        if (index === -1) {
          // Registro nuevo en Google Sheets no existente localmente
          claims.push({
            id: id,
            voucherNumber: id,
            ruta: item.ruta || item.Ruta || 'Ruta 1',
            vendedor: item.vendedor || item.Vendedor || '',
            piloto: item.piloto || item.Piloto || item.vendedor || '',
            cliente: item.cliente || item.Cliente || '',
            telefono: item.telefono || item.Telefono || '',
            factura: item.factura || item.Factura || '',
            producto: item.producto || item.Producto || '',
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
          // Actualizar estados si cambiaron en Google Sheets
          const actual = claims[index];
          if (actual.procesoAceptado !== aceptado || 
              actual.procesoRechazado !== rechazado || 
              actual.enProcesoEntrega !== enEntrega || 
              actual.cambioEntregado !== entregado || 
              actual.productoRecibido !== recibido ||
              (!actual.firmaCliente && firmaC)) {
            actual.procesoAceptado = aceptado;
            actual.procesoRechazado = rechazado;
            actual.enProcesoEntrega = enEntrega;
            actual.cambioEntregado = entregado;
            actual.productoRecibido = recibido;
            if (firmaC) actual.firmaCliente = firmaC;
            if (firmaV) actual.firmaVendedor = firmaV;
            huboCambios = true;
          }
        }
      }

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
  const claims = getClaims();
  const newRecord = req.body;
  if (!newRecord.id) {
    newRecord.id = 'REC-' + String(claims.length + 1).padStart(4, '0');
  }
  claims.unshift(newRecord);
  saveClaims(claims);

  // Sincronizar asíncronamente con Google Sheets
  enviarAGoogleSheetsConReintentos({
    hoja: "RECLAMOS",
    id: newRecord.id,
    ID_Reclamo: newRecord.id,
    ruta: newRecord.ruta,
    Ruta: newRecord.ruta,
    vendedor: newRecord.vendedor,
    Vendedor: newRecord.vendedor,
    cliente: newRecord.cliente,
    Cliente: newRecord.cliente,
    telefono: newRecord.telefono || newRecord.clientPhone || "",
    Telefono: newRecord.telefono || newRecord.clientPhone || "",
    factura: newRecord.factura,
    Factura: newRecord.factura,
    piloto: newRecord.piloto || newRecord.vendedor,
    Piloto: newRecord.piloto || newRecord.vendedor,
    photo: newRecord.photo || newRecord.foto || "",
    foto: newRecord.photo || newRecord.foto || "",
    producto: newRecord.producto,
    Producto: newRecord.producto,
    motivo: newRecord.motivo,
    Motivo: newRecord.motivo,
    fecha: newRecord.fecha,
    Fecha: newRecord.fecha,
    hora: newRecord.hora,
    Hora: newRecord.hora,
    firmaVendedor: newRecord.firmaVendedor || "",
    FirmaVendedor: newRecord.firmaVendedor || "",
    firmaCliente: newRecord.firmaCliente || "",
    FirmaCliente: newRecord.firmaCliente || "",
    procesoAceptado: newRecord.procesoAceptado ? "SI" : "NO",
    "Proceso Aceptado": newRecord.procesoAceptado ? "SI" : "NO",
    procesoRechazado: newRecord.procesoRechazado ? "SI" : "NO",
    "Proceso Rechazado": newRecord.procesoRechazado ? "SI" : "NO",
    enProcesoEntrega: newRecord.enProcesoEntrega ? "SI" : "NO",
    "En Proceso de Entrega": newRecord.enProcesoEntrega ? "SI" : "NO",
    cambioEntregado: newRecord.cambioEntregado ? "SI" : "NO",
    "Cambio Entregado": newRecord.cambioEntregado ? "SI" : "NO",
    productoRecibido: newRecord.productoRecibido ? "SI" : "NO",
    "Producto Recibido": newRecord.productoRecibido ? "SI" : "NO",
    fechaCambioEntregado: newRecord.fechaCambioEntregado || ""
  });

  res.status(201).json(newRecord);
});

app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => c.id === id || c.voucherNumber === id);
  if (index !== -1) {
    claims[index] = { ...claims[index], ...updatedData, id };
    saveClaims(claims);

    // Sincronizar actualización con Google Sheets
    enviarAGoogleSheetsConReintentos({
      action: "actualizar",
      hoja: "RECLAMOS",
      id: id,
      ID_Reclamo: id,
      ...claims[index]
    });

    res.json(claims[index]);
  } else {
    claims.unshift({ ...updatedData, id });
    saveClaims(claims);
    res.status(201).json(updatedData);
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

app.delete('/api/records', (req, res) => {
  saveClaims([]);
  res.json({ success: true, count: 0 });
});

app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  let claims = getClaims();
  claims = claims.filter((c: any) => c.id !== id && c.voucherNumber !== id);
  saveClaims(claims);

  enviarAGoogleSheetsConReintentos({
    action: "eliminar",
    hoja: "RECLAMOS",
    id: id,
    ID_Reclamo: id
  });

  res.json({ success: true, id });
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
