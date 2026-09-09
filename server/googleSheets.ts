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

  const ID_Reclamo = claim.id || claim.voucherNumber || '';
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
