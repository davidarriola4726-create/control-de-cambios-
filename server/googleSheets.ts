import { JWT } from 'google-auth-library';

export interface ServiceAccountCredentials {
  clientEmail?: string;
  privateKey?: string;
}

export const DEFAULT_SHEET_ID = '1H6VGhiSJaKH4QbtkmV6SMbR51ml_T4RKIKkPZHzGyPU';
export const DEFAULT_TAB_NAME = 'RECLAMOS';
export const SHEET_NAME_TITLE = 'Base de datos real';

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
      // Might be malformed or something else
    }
  }

  // 2. Check individual variables
  if (!email && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim();
  }

  if (!key && process.env.GOOGLE_PRIVATE_KEY) {
    // Handle escaped newlines from environment strings
    key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  return { email, key, sheetId, tabName };
}

/**
 * Checks if a Google Service Account or Webhook is configured.
 */
export function isGoogleSheetsConfigured(): boolean {
  if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) return true;
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
                properties: { title: tabName }
              }
            }
          ]
        })
      });
    }

    // 2. Check if row 1 has headers
    const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      tabName
    )}!A1:L1`;
    const headersRes = await fetch(headersUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const headersData = await headersRes.json().catch(() => ({}));
    const existingHeaders = headersData.values?.[0] || [];

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
  // Handle signatures: Google Sheets has a cell character limit of ~50,000.
  // If base64 is too long, we store a summary text to prevent Google API errors.
  let vSig = claim.vendorSignature || '';
  if (vSig.length > 35000) {
    vSig = `[Firma Digital Vendedor - ${claim.vendorName || claim.routeId}]`;
  }

  let cSig = claim.clientSignature || '';
  if (cSig.length > 35000) {
    cSig = `[Firma Digital Cliente - ${claim.clientName || 'Conforme'}]`;
  }

  return [
    claim.id || '',
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
 * Appends a claim record directly to Google Sheets using the Service Account.
 */
export async function appendClaimToGoogleSheets(claim: any): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    if (!isGoogleSheetsConfigured()) {
      return {
        success: false,
        message: 'Google Sheets no configurado. Defina las credenciales en el servidor.'
      };
    }

    const row = formatClaimRow(claim);

    // Option A: Direct Google Apps Script Webhook
    if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL.trim();
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append', row, claim })
      });
      if (whRes.ok) {
        return {
          success: true,
          message: 'Reclamo guardado en Google Sheets exitosamente (vía Webhook).'
        };
      }
    }

    // Option B: Google Service Account JWT
    const { sheetId, tabName } = getServiceAccountCredentials();
    const token = await getGoogleServiceAccountAccessToken();

    // Ensure tab and headers exist
    await ensureSheetStructure(token, sheetId, tabName);
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      tabName
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
      message: `Reclamo guardado exitosamente en Google Sheets (${tabName})`
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

    if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL.trim();
      const rows = claims.map((c) => formatClaimRow(c));
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', rows })
      });
      if (whRes.ok) {
        return {
          success: true,
          count: claims.length,
          message: `Sincronizados ${claims.length} reclamos a Google Sheets con éxito (vía Webhook).`
        };
      }
    }

    const { sheetId, tabName } = getServiceAccountCredentials();
    const token = await getGoogleServiceAccountAccessToken();

    // Ensure tab and headers exist
    await ensureSheetStructure(token, sheetId, tabName);

    // Read existing IDs to avoid duplicate rows
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      tabName
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
        message: 'Todos los reclamos ya están presentes en Google Sheets.'
      };
    }

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      tabName
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
}> {
  const creds = getServiceAccountCredentials();

  // If Webhook URL is set
  if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    return {
      configured: true,
      sheetId: creds.sheetId,
      tabName: creds.tabName,
      email: 'Google Apps Script Webhook',
      canAccess: true,
      sheetTitle: SHEET_NAME_TITLE
    };
  }

  if (!creds.email || !creds.key) {
    return {
      configured: false,
      sheetId: creds.sheetId,
      tabName: creds.tabName,
      email: creds.email,
      canAccess: false,
      error: 'Variables de entorno de Google Service Account no definidas.'
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
