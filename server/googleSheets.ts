import { JWT } from 'google-auth-library';

export interface ServiceAccountCredentials {
  clientEmail?: string;
  privateKey?: string;
}

export const DEFAULT_SHEET_ID = '1H6VGhiSJaKH4QbtkmV6SMbR51ml_T4RKIKkPZHzGyPU';
export const DEFAULT_TAB_NAME = 'RECLAMOS';
export const SHEET_NAME_TITLE = 'Base de datos real';

// Exact 12 columns requested by the user
export const RECLAMOS_COLUMNS = [
  'ID_Reclamo',
  'Ruta',
  'Vendedor',
  'Cliente',
  'Factura',
  'Piloto',
  'Producto',
  'Motivo',
  'Fecha',
  'Hora',
  'FirmaVendedor',
  'FirmaCliente'
];

/**
 * Retrieves the configured Google Sheets Webhook URL, if any.
 * Supports both GOOGLE_SHEETS_WEBHOOK and GOOGLE_SHEETS_WEBHOOK_URL.
 */
export function getWebhookUrl(): string | null {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK || process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return null;
  const trimmed = url.trim();
  // Filter out placeholders
  if (trimmed.startsWith('[') || trimmed.includes('PEGA AQUÍ') || trimmed.length < 15) {
    return null;
  }
  return trimmed;
}

/**
 * Extracts credentials from environment variables.
 * Supports:
 * - GOOGLE_SERVICE_ACCOUNT_KEY (JSON string or path)
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
 */
export function getServiceAccountCredentials(): {
  email: string | null;
  key: string | null;
  sheetId: string;
  tabName: string;
} {
  const sheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB || DEFAULT_TAB_NAME;

  let email: string | null = null;
  let key: string | null = null;

  // 1. Check if full JSON is provided in GOOGLE_SERVICE_ACCOUNT_KEY
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      email = parsed.client_email || null;
      key = parsed.private_key || null;
    } catch {
      // Malformed JSON
    }
  }

  // 2. Check individual variables
  if (!email && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim();
  }

  if (!key && process.env.GOOGLE_PRIVATE_KEY) {
    key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  return { email, key, sheetId, tabName };
}

/**
 * Checks if Google Sheets integration is configured (either via Webhook or Service Account).
 */
export function isGoogleSheetsConfigured(): boolean {
  if (getWebhookUrl()) return true;
  const { email, key } = getServiceAccountCredentials();
  return Boolean(email && key);
}

/**
 * Retrieves a valid Google OAuth access token using the Service Account credentials.
 */
export async function getGoogleServiceAccountAccessToken(): Promise<string> {
  const { email, key } = getServiceAccountCredentials();

  if (!email || !key) {
    throw new Error(
      'Credenciales de Cuenta de Servicio no configuradas. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY o GOOGLE_SERVICE_ACCOUNT_KEY.'
    );
  }

  const jwtClient = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const res = await jwtClient.getAccessToken();
  if (!res.token) {
    throw new Error('No se pudo generar el token de acceso para la cuenta de servicio de Google.');
  }

  return res.token;
}

/**
 * Ensures that the target worksheet and headers exist in Google Sheets.
 */
export async function ensureSheetStructure(
  accessToken: string,
  sheetId: string,
  tabName: string
): Promise<void> {
  try {
    // 1. Check if tab exists
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `No se pudo acceder a la hoja ${sheetId}. Verifique permisos.`
      );
    }

    const metaData = await metaRes.json();
    const sheets: any[] = metaData.sheets || [];
    const hasTab = sheets.some((s) => s.properties?.title === tabName);

    if (!hasTab) {
      // Add sheet tab
      const addTabUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
      await fetch(addTabUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                  gridProperties: { rowCount: 1000, columnCount: 14 }
                }
              }
            }
          ]
        })
      });
    }

    // 2. Check if headers exist
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      tabName
    )}!A1:L1`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const readData = await readRes.json().catch(() => ({}));
    const existingHeaders = (readData.values && readData.values[0]) || [];

    if (existingHeaders.length === 0 || existingHeaders[0] !== RECLAMOS_COLUMNS[0]) {
      // Write headers
      const putHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        tabName
      )}!A1:L1?valueInputOption=USER_ENTERED`;
      await fetch(putHeadersUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [RECLAMOS_COLUMNS]
        })
      });
    }
  } catch (err: any) {
    console.warn('[ensureSheetStructure] Advertencia:', err.message);
  }
}

/**
 * Formats a claim record into the exact 12 columns requested:
 * ID_Reclamo, Ruta, Vendedor, Cliente, Factura, Piloto, Producto, Motivo, Fecha, Hora, FirmaVendedor, FirmaCliente
 */
export function formatClaimRow(claim: any): (string | number)[] {
  let vSig = claim.vendorSignature || '';
  if (vSig.length > 35000) {
    vSig = `[Firma Digital Vendedor - ${claim.vendorName || claim.routeId}]`;
  }

  let cSig = claim.clientSignature || '';
  if (cSig.length > 35000) {
    cSig = `[Firma Digital Cliente - ${claim.clientName || 'Conforme'}]`;
  }

  return [
    claim.id || claim.voucherNumber || '',
    claim.routeId || '',
    claim.vendorName || '',
    claim.clientName || '',
    claim.invoiceNumber || 'S/F',
    claim.deliveryPerson || 'Piloto Asignado',
    claim.productName || '',
    claim.reason || 'Defecto de Fábrica',
    claim.formattedDate || '',
    claim.formattedTime || '',
    vSig,
    cSig
  ];
}

/**
 * Formats the complete payload for POST to Google Sheets Webhook.
 * Contains both top-level keys with the exact column names:
 * ID_Reclamo, Ruta, Vendedor, Cliente, Factura, Piloto, Producto, Motivo, Fecha, Hora, FirmaVendedor, FirmaCliente
 * and array/sub-object formats for maximum compatibility with any Apps Script implementation.
 */
export function formatWebhookPayload(claim: any, tabName: string) {
  let vSig = claim.vendorSignature || '';
  if (vSig.length > 35000) {
    vSig = `[Firma Digital Vendedor - ${claim.vendorName || claim.routeId}]`;
  }

  let cSig = claim.clientSignature || '';
  if (cSig.length > 35000) {
    cSig = `[Firma Digital Cliente - ${claim.clientName || 'Conforme'}]`;
  }

  const ID_Reclamo = claim.voucherNumber || claim.id || '';
  const Ruta = claim.routeId || '';
  const Vendedor = claim.vendorName || '';
  const Cliente = claim.clientName || '';
  const Factura = claim.invoiceNumber || 'S/F';
  const Piloto = claim.deliveryPerson || 'Piloto Asignado';
  const Producto = claim.productName || '';
  const Motivo = claim.reason || 'Defecto de Fábrica';
  const Fecha = claim.formattedDate || '';
  const Hora = claim.formattedTime || '';
  const FirmaVendedor = vSig;
  const FirmaCliente = cSig;

  const row = [
    ID_Reclamo,
    Ruta,
    Vendedor,
    Cliente,
    Factura,
    Piloto,
    Producto,
    Motivo,
    Fecha,
    Hora,
    FirmaVendedor,
    FirmaCliente
  ];

  return {
    // Exact requested fields at root level
    ID_Reclamo,
    Ruta,
    Vendedor,
    Cliente,
    Factura,
    Piloto,
    Producto,
    Motivo,
    Fecha,
    Hora,
    FirmaVendedor,
    FirmaCliente,

    // Auxiliary parameters for standard Apps Script patterns
    action: 'append',
    tab: tabName,
    sheetName: tabName,
    row,
    data: {
      ID_Reclamo,
      Ruta,
      Vendedor,
      Cliente,
      Factura,
      Piloto,
      Producto,
      Motivo,
      Fecha,
      Hora,
      FirmaVendedor,
      FirmaCliente
    }
  };
}

/**
 * Sends data to the Google Sheets Webhook URL.
 */
export async function sendToGoogleSheetsWebhook(payload: any): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return {
      success: false,
      error: 'URL de Webhook no configurada en las variables de entorno (GOOGLE_SHEETS_WEBHOOK).'
    };
  }

  try {
    console.log(`[GoogleSheets Webhook] Enviando reclamo a ${webhookUrl.slice(0, 45)}...`);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    // Google Apps Script redirects with 302 or answers 200
    if (res.ok || res.status === 302 || res.status === 307) {
      console.log('[GoogleSheets Webhook] Reclamo recibido y registrado con éxito.');
      return {
        success: true,
        message: 'Reclamo guardado exitosamente en Google Sheets mediante Webhook.'
      };
    }

    const responseText = await res.text().catch(() => '');
    console.warn(`[GoogleSheets Webhook] Respuesta HTTP ${res.status}:`, responseText.slice(0, 200));
    return {
      success: false,
      error: `El Webhook respondió con estado ${res.status}: ${responseText.slice(0, 150)}`
    };
  } catch (err: any) {
    console.error('[GoogleSheets Webhook Exception]:', err.message);
    return {
      success: false,
      error: `Error al contactar el Webhook de Google Sheets: ${err.message}`
    };
  }
}

/**
 * Appends a claim record directly to Google Sheets using either:
 * 1. Webhook (GOOGLE_SHEETS_WEBHOOK / GOOGLE_SHEETS_WEBHOOK_URL) - Priority
 * 2. Service Account JWT credentials
 */
export async function appendClaimToGoogleSheets(claim: any): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const webhookUrl = getWebhookUrl();
    const tabName = process.env.GOOGLE_SHEETS_TAB || DEFAULT_TAB_NAME;

    // 1. PRIORITIZE GOOGLE SHEETS WEBHOOK (Direct POST with the 12 fields)
    if (webhookUrl) {
      const payload = formatWebhookPayload(claim, tabName);
      return await sendToGoogleSheetsWebhook(payload);
    }

    // 2. FALLBACK TO GOOGLE SERVICE ACCOUNT JWT
    if (isGoogleSheetsConfigured()) {
      const { sheetId, tabName: saTab } = getServiceAccountCredentials();
      const token = await getGoogleServiceAccountAccessToken();

      // Ensure tab and headers exist
      await ensureSheetStructure(token, sheetId, saTab);

      const row = formatClaimRow(claim);
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        saTab
      )}!A:L:append?valueInputOption=USER_ENTERED`;

      const res = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || res.statusText;
        console.error('[GoogleSheets] Error al escribir en hoja:', msg);
        return { success: false, error: msg };
      }

      return {
        success: true,
        message: `Reclamo guardado exitosamente en Google Sheets (${saTab})`
      };
    }

    return {
      success: false,
      message: 'Google Sheets no configurado. Defina GOOGLE_SHEETS_WEBHOOK o credenciales de Service Account.'
    };
  } catch (err: any) {
    console.error('[GoogleSheets] Error inesperado:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes multiple claims to Google Sheets in bulk.
 */
export async function syncAllClaimsToGoogleSheets(claims: any[]): Promise<{
  success: boolean;
  count: number;
  message?: string;
  error?: string;
}> {
  try {
    if (!isGoogleSheetsConfigured()) {
      return {
        success: false,
        count: 0,
        message: 'Google Sheets no configurado.'
      };
    }

    const webhookUrl = getWebhookUrl();
    const tabName = process.env.GOOGLE_SHEETS_TAB || DEFAULT_TAB_NAME;

    // A. Webhook Sync
    if (webhookUrl) {
      const rows = claims.map((c) => formatClaimRow(c));
      const items = claims.map((c) => formatWebhookPayload(c, tabName));
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          tab: tabName,
          sheetName: tabName,
          rows,
          items,
          count: claims.length
        }),
        redirect: 'follow'
      });

      if (whRes.ok || whRes.status === 302 || whRes.status === 307) {
        return {
          success: true,
          count: claims.length,
          message: `Sincronizados ${claims.length} reclamos a Google Sheets con éxito (vía Webhook).`
        };
      }
    }

    // B. Service Account Sync
    const { sheetId, tabName: saTab } = getServiceAccountCredentials();
    const token = await getGoogleServiceAccountAccessToken();

    // Ensure tab and headers exist
    await ensureSheetStructure(token, sheetId, saTab);

    // Read existing IDs to avoid duplicate rows
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      saTab
    )}!A:A`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const readData = await readRes.json().catch(() => ({}));
    const existingIds = new Set(
      (readData.values || []).map((r: string[]) => (r[0] || '').trim()).filter(Boolean)
    );

    const newRows = claims
      .filter((c) => !existingIds.has(c.id))
      .map((c) => formatClaimRow(c));

    if (newRows.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Todos los reclamos ya están sincronizados en Google Sheets.'
      };
    }

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      saTab
    )}!A:L:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: newRows
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, count: 0, error: errData?.error?.message || res.statusText };
    }

    return {
      success: true,
      count: newRows.length,
      message: `Se sincronizaron ${newRows.length} reclamos a Google Sheets con éxito.`
    };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Checks connectivity and returns diagnostics.
 */
export async function testGoogleSheetsStatus(): Promise<{
  configured: boolean;
  sheetId: string;
  tabName: string;
  email: string | null;
  canAccess: boolean;
  error?: string;
  sheetTitle?: string;
  isWebhook?: boolean;
}> {
  const webhookUrl = getWebhookUrl();
  const tabName = process.env.GOOGLE_SHEETS_TAB || DEFAULT_TAB_NAME;
  const sheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;

  // 1. If Webhook URL is set and valid
  if (webhookUrl) {
    return {
      configured: true,
      sheetId,
      tabName,
      email: 'Webhook Activo (GOOGLE_SHEETS_WEBHOOK)',
      canAccess: true,
      sheetTitle: SHEET_NAME_TITLE,
      isWebhook: true
    };
  }

  // 2. Service account check
  const creds = getServiceAccountCredentials();
  if (!creds.email || !creds.key) {
    return {
      configured: false,
      sheetId: creds.sheetId,
      tabName: creds.tabName,
      email: creds.email,
      canAccess: false,
      error: 'Defina GOOGLE_SHEETS_WEBHOOK o credenciales de Google Service Account.'
    };
  }

  try {
    const token = await getGoogleServiceAccountAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${creds.sheetId}?fields=properties.title,sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        configured: true,
        sheetId: creds.sheetId,
        tabName: creds.tabName,
        email: creds.email,
        canAccess: false,
        error:
          errData?.error?.message ||
          `Error ${res.status}: Verifique que la hoja esté compartida con ${creds.email} como Editor.`
      };
    }

    const data = await res.json();
    return {
      configured: true,
      sheetId: creds.sheetId,
      tabName: creds.tabName,
      email: creds.email,
      canAccess: true,
      sheetTitle: data.properties?.title || SHEET_NAME_TITLE
    };
  } catch (err: any) {
    return {
      configured: true,
      sheetId: creds.sheetId,
      tabName: creds.tabName,
      email: creds.email,
      canAccess: false,
      error: err.message
    };
  }
}

/**
 * Normalizes route string into standard "RUTA-1", "RUTA-2", etc.
 */
export function normalizeRoute(rawRoute: any, vendorName?: string): string {
  const str = String(rawRoute || '').trim();
  if (str) {
    const match = str.match(/^(?:ruta\s*[-_]?\s*|r\s*[-_]?\s*)?(\d+)/i);
    if (match && match[1]) {
      return `RUTA-${parseInt(match[1], 10)}`;
    }
    const upper = str.toUpperCase();
    if (upper.startsWith('RUTA-')) return upper;
  }
  if (vendorName) {
    const vStr = String(vendorName).trim().toLowerCase();
    const vendorMap: { [key: string]: string } = {
      'brian': 'RUTA-1',
      'melvin sequeen': 'RUTA-2',
      'melvin': 'RUTA-2',
      'mel marvin': 'RUTA-3',
      'marcos': 'RUTA-4',
      'ruta 5': 'RUTA-5',
      'gustavo': 'RUTA-6',
      'ruta 7': 'RUTA-7',
      'marvin otoniel': 'RUTA-8',
      'sergio': 'RUTA-9',
      'edgar': 'RUTA-10',
      'esaú': 'RUTA-11',
      'esau': 'RUTA-11'
    };
    for (const [vKey, rId] of Object.entries(vendorMap)) {
      if (vStr.includes(vKey)) return rId;
    }
  }
  return str.toUpperCase() || 'RUTA-1';
}

function formatDateString(fecha: any): string {
  if (!fecha) return new Date().toLocaleDateString('es-GT');
  const str = String(fecha).trim();
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  if (str.startsWith('Date(')) {
    const match = str.match(/Date\((\d+),(\d+),(\d+)/);
    if (match) {
      const y = match[1];
      const m = String(parseInt(match[2], 10) + 1).padStart(2, '0');
      const d = String(parseInt(match[3], 10)).padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }
  return str;
}

function formatTimeString(hora: any): string {
  if (!hora) return '00:00';
  const str = String(hora).trim();
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }
  const parts = str.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return str;
}

function parseDateToISO(fecha: string, hora: string): string {
  try {
    if (!fecha) return new Date().toISOString();
    const str = String(fecha).trim();
    if (str.startsWith('Date(')) {
      const match = str.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+))?/);
      if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const d = parseInt(match[3], 10);
        const h = match[4] ? parseInt(match[4], 10) : 0;
        const min = match[5] ? parseInt(match[5], 10) : 0;
        return new Date(y, m, d, h, min).toISOString();
      }
    }
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }
      const timeParts = (hora || '00:00').split(':');
      const h = parseInt(timeParts[0] || '0', 10);
      const min = parseInt(timeParts[1] || '0', 10);
      const dt = new Date(year, month, day, h, min);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  } catch {}
  return new Date().toISOString();
}

/**
 * Parses a raw item (array or object from Webhook, Sheets API, or gviz) into a ProductClaim.
 */
export function parseRowToClaim(raw: any, index: number): any {
  let id = '';
  let ruta = '';
  let vendedor = '';
  let cliente = '';
  let factura = '';
  let piloto = '';
  let producto = '';
  let motivo = '';
  let fecha = '';
  let hora = '';
  let firmaVendedor = '';
  let firmaCliente = '';

  if (Array.isArray(raw)) {
    id = raw[0] !== undefined && raw[0] !== null ? String(raw[0]) : '';
    ruta = raw[1] !== undefined && raw[1] !== null ? String(raw[1]) : '';
    vendedor = raw[2] !== undefined && raw[2] !== null ? String(raw[2]) : '';
    cliente = raw[3] !== undefined && raw[3] !== null ? String(raw[3]) : '';
    factura = raw[4] !== undefined && raw[4] !== null ? String(raw[4]) : '';
    piloto = raw[5] !== undefined && raw[5] !== null ? String(raw[5]) : '';
    producto = raw[6] !== undefined && raw[6] !== null ? String(raw[6]) : '';
    motivo = raw[7] !== undefined && raw[7] !== null ? String(raw[7]) : '';
    fecha = raw[8] !== undefined && raw[8] !== null ? String(raw[8]) : '';
    hora = raw[9] !== undefined && raw[9] !== null ? String(raw[9]) : '';
    firmaVendedor = raw[10] !== undefined && raw[10] !== null ? String(raw[10]) : '';
    firmaCliente = raw[11] !== undefined && raw[11] !== null ? String(raw[11]) : (raw[10] ? String(raw[10]) : '');
  } else if (raw && typeof raw === 'object') {
    id = raw.ID_Reclamo || raw.id_reclamo || raw.id || raw.ID || raw.voucherNumber || '';
    ruta = raw.Ruta || raw.ruta || raw.routeId || raw.RutaId || '';
    vendedor = raw.Vendedor || raw['Vendedor '] || raw.vendedor || raw.vendorName || '';
    cliente = raw.Cliente || raw.cliente || raw.clientName || '';
    factura = raw.Factura || raw.factura || raw.invoiceNumber || '';
    piloto = raw.Piloto || raw.piloto || raw.deliveryPerson || '';
    producto = raw.Producto || raw.producto || raw.productName || '';
    motivo = raw.Motivo || raw.motivo || raw.reason || '';
    fecha = raw.Fecha || raw.fecha || raw.formattedDate || '';
    hora = raw.Hora || raw.hora || raw.formattedTime || '';
    firmaVendedor = raw.FirmaVendedor || raw.firmaVendedor || raw.Firma || raw.firma || raw.vendorSignature || '';
    firmaCliente = raw.FirmaCliente || raw.FirmaClienete || raw.firmaCliente || raw.Firma || raw.firma || raw.clientSignature || '';
  }

  const finalRoute = normalizeRoute(ruta, vendedor);
  const formattedD = formatDateString(fecha);
  const formattedT = formatTimeString(hora);
  const baseId = String(id || '').trim();
  const claimId = baseId ? `${baseId}_${index + 1}` : `claim-row-${index + 1}`;
  
  let voucherNumber = '';
  if (baseId.startsWith('VCH-')) {
    voucherNumber = baseId;
  } else if (raw?.voucherNumber && String(raw.voucherNumber).startsWith('VCH-')) {
    voucherNumber = String(raw.voucherNumber);
  } else {
    voucherNumber = `VCH-2026-${String(index + 1).padStart(4, '0')}`;
  }

  return {
    id: claimId,
    voucherNumber,
    createdAt: parseDateToISO(formattedD, formattedT),
    formattedDate: formattedD,
    formattedTime: formattedT,
    routeId: finalRoute,
    vendorName: String(vendedor || ''),
    clientName: String(cliente || 'Cliente'),
    invoiceNumber: String(factura || 'S/F'),
    deliveryPerson: String(piloto || 'Piloto Asignado'),
    productName: String(producto || 'Producto General'),
    reason: (motivo || 'Defecto de Fábrica'),
    vendorSignature: String(firmaVendedor || ''),
    clientSignature: String(firmaCliente || ''),
    quantity: Number(raw?.quantity) || 1,
    unit: raw?.unit || 'Unidades',
    status: raw?.status || 'Cambio Realizado',
    syncedToCloud: true
  };
}

/**
 * Reads all claims directly from Google Sheets (via Webhook, Direct Google query, or Service Account).
 */
export async function readAllClaimsFromGoogleSheets(): Promise<{
  success: boolean;
  data: any[];
  count: number;
  source: string;
  error?: string;
}> {
  const webhookUrl = getWebhookUrl();
  const tabName = process.env.GOOGLE_SHEETS_TAB || DEFAULT_TAB_NAME;
  const sheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;

  // 1. TRY WEBHOOK (GET & POST)
  if (webhookUrl) {
    // 1.1 Webhook GET
    try {
      const getUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=read&tab=${encodeURIComponent(tabName)}`;
      const res = await fetch(getUrl, {
        headers: { Accept: 'application/json, text/plain, */*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const text = await res.text();
        let parsedJson: any = null;
        try {
          parsedJson = JSON.parse(text);
        } catch {}
        const rowsOrObjects = parsedJson?.records || parsedJson?.data || parsedJson?.rows || (Array.isArray(parsedJson) ? parsedJson : null);
        if (Array.isArray(rowsOrObjects) && rowsOrObjects.length > 0) {
          const claims = rowsOrObjects
            .filter((item: any) => {
              if (Array.isArray(item)) return item[0] !== 'ID_Reclamo';
              return item?.ID_Reclamo !== 'ID_Reclamo';
            })
            .map((item: any, idx: number) => parseRowToClaim(item, idx));
          return { success: true, count: claims.length, data: claims, source: 'webhook-get' };
        }
      }
    } catch (e: any) {
      console.warn('[readAllClaimsFromGoogleSheets] Webhook GET failed:', e.message);
    }

    // 1.2 Webhook POST
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'read', tab: tabName, sheetName: tabName }),
        redirect: 'follow',
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const text = await res.text();
        let parsedJson: any = null;
        try {
          parsedJson = JSON.parse(text);
        } catch {}
        const rowsOrObjects = parsedJson?.records || parsedJson?.data || parsedJson?.rows || (Array.isArray(parsedJson) ? parsedJson : null);
        if (Array.isArray(rowsOrObjects) && rowsOrObjects.length > 0) {
          const claims = rowsOrObjects
            .filter((item: any) => {
              if (Array.isArray(item)) return item[0] !== 'ID_Reclamo';
              return item?.ID_Reclamo !== 'ID_Reclamo';
            })
            .map((item: any, idx: number) => parseRowToClaim(item, idx));
          return { success: true, count: claims.length, data: claims, source: 'webhook-post' };
        }
      }
    } catch (e: any) {
      console.warn('[readAllClaimsFromGoogleSheets] Webhook POST failed:', e.message);
    }
  }

  // 2. DIRECT SPREADSHEET QUERY VIA GVIZ
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (match && match[1]) {
        const parsedGviz = JSON.parse(match[1]);
        if (parsedGviz?.table?.rows) {
          const rows = parsedGviz.table.rows;
          const claims: any[] = [];
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const getVal = (idx: number) => {
              const c = r.c ? r.c[idx] : null;
              if (!c) return '';
              return c.f !== undefined && c.f !== null ? String(c.f) : (c.v !== null && c.v !== undefined ? String(c.v) : '');
            };
            const id = getVal(0);
            if (id === 'ID_Reclamo' || id === 'ID') continue;
            if (!id && !getVal(1) && !getVal(3)) continue; // Empty row
            const rawArray = [
              getVal(0), // ID_Reclamo
              getVal(1), // Ruta
              getVal(2), // Vendedor
              getVal(3), // Cliente
              getVal(4), // Factura
              getVal(5), // Piloto
              getVal(6), // Producto
              getVal(7), // Motivo
              getVal(8), // Fecha
              getVal(9), // Hora
              getVal(10), // FirmaVendedor
              getVal(11) // FirmaCliente
            ];
            claims.push(parseRowToClaim(rawArray, i));
          }
          return { success: true, count: claims.length, data: claims, source: 'google-sheets-live' };
        }
      }
    }
  } catch (e: any) {
    console.warn('[readAllClaimsFromGoogleSheets] gviz query failed:', e.message);
  }

  // 3. SERVICE ACCOUNT API V4
  if (isGoogleSheetsConfigured()) {
    try {
      const { sheetId: saSheetId, tabName: saTab } = getServiceAccountCredentials();
      const token = await getGoogleServiceAccountAccessToken();
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${saSheetId}/values/${encodeURIComponent(saTab)}!A2:L`;
      const res = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const data = await res.json();
        const values: any[][] = data.values || [];
        const claims = values
          .filter((row) => row && row.length > 0 && row[0] !== 'ID_Reclamo')
          .map((row, idx) => parseRowToClaim(row, idx));
        return { success: true, count: claims.length, data: claims, source: 'google-sheets-api' };
      }
    } catch (e: any) {
      console.warn('[readAllClaimsFromGoogleSheets] Service Account API failed:', e.message);
    }
  }

  return {
    success: false,
    count: 0,
    data: [],
    source: 'none',
    error: 'No se pudo leer la hoja de cálculo de Google Sheets.'
  };
}

