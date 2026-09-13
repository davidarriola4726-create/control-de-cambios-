import { ProductClaim, UserAccount, ClaimReason, ClaimStatus } from '../types';
import { DEFAULT_USERS } from '../data/usersData';

export const LOCAL_STORAGE_SHEET_KEY = 'myg_google_sheets_spreadsheet_id';

// Default configuration provided by the user
export const DEFAULT_SPREADSHEET_ID = '1H6VGhiSJaKH4QbtkmV6SMbR51ml_T4RKIKkPZHzGyPU';
export const DEFAULT_SHEET_TITLE = 'Base de datos real';
export const DEFAULT_RECLAMOS_TAB = 'RECLAMOS';

// Exact 12 columns requested
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
 * Extracts the Google Spreadsheet ID from either a full URL or a raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const trimmed = input.trim();
  // Match https://docs.google.com/spreadsheets/d/{ID}/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Otherwise if it's already an ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed || DEFAULT_SPREADSHEET_ID;
}

export function getStoredSpreadsheetId(): string {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SHEET_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {
    console.warn('Could not read spreadsheet ID from localStorage', e);
  }
  return DEFAULT_SPREADSHEET_ID;
}

export function saveSpreadsheetId(id: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, id || DEFAULT_SPREADSHEET_ID);
  } catch (e) {
    console.warn('Could not store spreadsheet ID in localStorage', e);
  }
}

export interface SheetConnectionInfo {
  spreadsheetTitle: string;
  hasUsuariosSheet: boolean;
  hasReclamosSheet: boolean;
  reclamosSheetId: number;
  usuariosSheetId: number;
  totalUsersFound: number;
  totalClaimsFound: number;
}

/**
 * Validates connection and inspects available sheets in the spreadsheet.
 */
export async function inspectSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetConnectionInfo> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=properties.title,sheets.properties`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData?.error?.message || 'Error al conectar con Google Sheets.';
    throw new Error(message);
  }

  const data = await res.json();
  const sheets = data.sheets || [];

  let hasUsuarios = false;
  let hasReclamos = false;
  let reclamosSheetId = 0;
  let usuariosSheetId = 0;

  for (const s of sheets) {
    const title = (s.properties?.title || '').trim().toUpperCase();
    if (title === 'USUARIOS') {
      hasUsuarios = true;
      usuariosSheetId = s.properties.sheetId;
    }
    if (title === 'RECLAMOS') {
      hasReclamos = true;
      reclamosSheetId = s.properties.sheetId;
    }
  }

  return {
    spreadsheetTitle: data.properties?.title || DEFAULT_SHEET_TITLE,
    hasUsuariosSheet: hasUsuarios,
    hasReclamosSheet: hasReclamos,
    reclamosSheetId,
    usuariosSheetId,
    totalUsersFound: 0,
    totalClaimsFound: 0
  };
}

/**
 * Creates missing sheets (USUARIOS, RECLAMOS) and initializes column headers.
 */
export async function initializeSheetStructure(
  accessToken: string,
  spreadsheetId: string,
  needUsuarios: boolean,
  needReclamos: boolean
): Promise<void> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const requests: any[] = [];

  if (needUsuarios) {
    requests.push({
      addSheet: {
        properties: {
          title: 'USUARIOS',
          gridProperties: { rowCount: 100, columnCount: 10 }
        }
      }
    });
  }

  if (needReclamos) {
    requests.push({
      addSheet: {
        properties: {
          title: 'RECLAMOS',
          gridProperties: { rowCount: 1000, columnCount: 14 }
        }
      }
    });
  }

  if (requests.length > 0) {
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      }
    );

    if (!batchRes.ok) {
      const errorData = await batchRes.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || 'No se pudieron crear las pestañas en Google Sheets.'
      );
    }
  }

  // Populate USUARIOS headers and initial rows if needed
  if (needUsuarios) {
    const usuariosValues = [
      ['ID', 'TipoUsuario', 'NombreRuta', 'Contraseña', 'NombreVendedor', 'Estado'],
      ...DEFAULT_USERS.map((u) => [
        u.id,
        u.role,
        u.username,
        u.password,
        u.vendorName,
        'Activo'
      ])
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/USUARIOS!A1:F${usuariosValues.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: usuariosValues })
      }
    );
  }

  // Populate RECLAMOS headers with the exact 12 columns requested
  if (needReclamos) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/RECLAMOS!A1:L1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [RECLAMOS_COLUMNS] })
      }
    );
  }
}

/**
 * Reads users from the "USUARIOS" sheet.
 */
export async function fetchUsuariosFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<UserAccount[]> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/USUARIOS!A1:F100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('No se pudo leer la hoja USUARIOS de Google Sheets.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) return [];

  const users: UserAccount[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]?.trim()) continue;

    const id = row[0]?.trim();
    const role = (row[1]?.trim() === 'ADMIN' ? 'ADMIN' : 'ROUTE') as 'ADMIN' | 'ROUTE';
    const username = (row[2] || '').trim();
    const password = (row[3] || 'Mgyg').trim();
    const vendorName = (row[4] || '').trim();

    users.push({
      id: id || `user-${i}`,
      username: username || (role === 'ADMIN' ? 'Admin' : `RUTA-${i}`),
      displayName: vendorName || username,
      role,
      routeId: role === 'ROUTE' ? username : undefined,
      vendorName,
      password
    });
  }

  return users;
}

/**
 * Reads claims from the "RECLAMOS" sheet.
 * Supports both the exact 12 columns requested:
 * [ID_Reclamo, Ruta, Vendedor, Cliente, Factura, Piloto, Producto, Motivo, Fecha, Hora, FirmaVendedor, FirmaCliente]
 * and the legacy 13 columns.
 */
export async function fetchReclamosFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<ProductClaim[]> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/RECLAMOS!A1:M1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('No se pudo leer la hoja RECLAMOS de Google Sheets.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) {
    return [];
  }

  const claims: ProductClaim[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]?.trim()) continue;

    const isLegacy13 = row.length >= 13 && (row[1]?.startsWith('VCH-') || row[2]?.includes('/'));

    let id: string;
    let voucherNumber: string;
    let routeId: string;
    let vendorName: string;
    let clientName: string;
    let invoiceNumber: string;
    let deliveryPerson: string;
    let productName: string;
    let reason: ClaimReason;
    let formattedDate: string;
    let formattedTime: string;
    let vendorSignature: string;
    let clientSignature: string;
    let status: ClaimStatus = 'Cambio Realizado';

    if (isLegacy13) {
      id = row[0]?.trim() || `REC-${i}`;
      voucherNumber = row[1]?.trim() || `VCH-${id}`;
      const fechaHora = (row[2] || '').trim();
      routeId = (row[3] || 'RUTA-1').trim();
      vendorName = (row[4] || '').trim();
      clientName = (row[5] || '').trim();
      invoiceNumber = (row[6] || '').trim();
      deliveryPerson = (row[7] || '').trim();
      productName = (row[8] || '').trim();
      reason = (row[9] || 'Defecto de Fábrica').trim() as ClaimReason;
      vendorSignature = (row[10] || '').trim();
      clientSignature = (row[11] || '').trim();
      status = (row[12] || 'Cambio Realizado').trim() as ClaimStatus;

      formattedDate = fechaHora.split(' ')[0] || '08/09/2026';
      formattedTime = fechaHora.split(' ')[1] || '12:00';
    } else {
      // Exact 12 columns requested:
      // 0: ID_Reclamo, 1: Ruta, 2: Vendedor, 3: Cliente, 4: Factura, 5: Piloto, 6: Producto, 7: Motivo, 8: Fecha, 9: Hora, 10: FirmaVendedor, 11: FirmaCliente
      id = row[0]?.trim() || `claim-${i}`;
      voucherNumber = id.startsWith('VCH-') ? id : `VCH-${id.replace('claim-', '')}`;
      routeId = (row[1] || 'RUTA-1').trim();
      vendorName = (row[2] || '').trim();
      clientName = (row[3] || '').trim();
      invoiceNumber = (row[4] || '').trim();
      deliveryPerson = (row[5] || '').trim();
      productName = (row[6] || '').trim();
      reason = (row[7] || 'Defecto de Fábrica').trim() as ClaimReason;
      formattedDate = (row[8] || '08/09/2026').trim();
      formattedTime = (row[9] || '12:00').trim();
      vendorSignature = (row[10] || '').trim();
      clientSignature = (row[11] || '').trim();
    }

    claims.push({
      id,
      voucherNumber,
      createdAt: new Date().toISOString(),
      formattedDate,
      formattedTime,
      routeId,
      vendorName,
      clientName,
      invoiceNumber,
      deliveryPerson,
      productName,
      reason,
      vendorSignature,
      clientSignature,
      quantity: 1,
      unit: 'Unidades',
      status,
      syncedToCloud: true
    });
  }

  return claims;
}

/**
 * Appends a new claim directly to the "RECLAMOS" sheet with the 12 columns.
 */
export async function appendReclamoToSheet(
  accessToken: string,
  spreadsheetId: string,
  claim: ProductClaim
): Promise<void> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/RECLAMOS!A:L:append?valueInputOption=USER_ENTERED`;

  let vSig = claim.vendorSignature || '';
  if (vSig.length > 35000) {
    vSig = `[Firma Digital Vendedor - ${claim.vendorName || claim.routeId}]`;
  }
  let cSig = claim.clientSignature || '';
  if (cSig.length > 35000) {
    cSig = `[Firma Digital Cliente - ${claim.clientName || 'Conforme'}]`;
  }

  // Exact 12 columns requested:
  // ID_Reclamo, Ruta, Vendedor, Cliente, Factura, Piloto, Producto, Motivo, Fecha, Hora, FirmaVendedor, FirmaCliente
  const rowValues = [
    claim.id,
    claim.routeId,
    claim.vendorName,
    claim.clientName,
    claim.invoiceNumber || 'S/F',
    claim.deliveryPerson || 'Piloto Asignado',
    claim.productName,
    claim.reason,
    claim.formattedDate,
    claim.formattedTime,
    vSig,
    cSig
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowValues]
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message ||
        'Error al guardar el reclamo en la hoja RECLAMOS de Google Sheets.'
    );
  }
}

/**
 * Appends a claim via the server-side Service Account endpoint.
 */
export async function appendReclamoViaBackend(claim: ProductClaim): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/sheets/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claim)
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.message || res.statusText };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Fetches Service Account diagnostics and connection status from the backend.
 */
export async function fetchSheetsServerStatus(): Promise<{
  success: boolean;
  configured: boolean;
  canAccess: boolean;
  sheetId: string;
  tabName: string;
  sheetTitle?: string;
  email?: string | null;
  error?: string;
  defaultSheetId: string;
  defaultTab: string;
  columns: string[];
  isWebhook?: boolean;
}> {
  try {
    const res = await fetch('/api/sheets/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.warn('Could not fetch server sheets status:', e);
  }
  return {
    success: false,
    configured: false,
    canAccess: false,
    sheetId: DEFAULT_SPREADSHEET_ID,
    tabName: DEFAULT_RECLAMOS_TAB,
    defaultSheetId: DEFAULT_SPREADSHEET_ID,
    defaultTab: DEFAULT_RECLAMOS_TAB,
    columns: RECLAMOS_COLUMNS
  };
}

/**
 * Reads all claims directly from Google Sheets using the configured GOOGLE_SHEETS_WEBHOOK.
 * Performs a GET request to the webhook or the backend endpoint reading the webhook.
 */
export async function fetchClaimsFromWebhook(): Promise<ProductClaim[]> {
  try {
    // 1. Try to read from /api/records (which performs GET to GOOGLE_SHEETS_WEBHOOK)
    const res = await fetch('/api/records?refresh=webhook');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Backend webhook read error, attempting direct client fetch:', e);
  }

  // 2. Fallback to direct client fetch if webhookUrl is known
  try {
    const configRes = await fetch('/api/webhook/url');
    if (configRes.ok) {
      const config = await configRes.json();
      if (config.webhookUrl) {
        const getUrl = `${config.webhookUrl}${config.webhookUrl.includes('?') ? '&' : '?'}action=read&tab=RECLAMOS`;
        const res = await fetch(getUrl, { redirect: 'follow' });
        if (res.ok) {
          const rawData = await res.json();
          const items = Array.isArray(rawData) ? rawData : (rawData.records || rawData.data || []);
          if (Array.isArray(items)) {
            return items.map((r: any, idx: number) => {
              const baseId = String(r.ID_Reclamo || r.id || '').trim();
              return {
                id: baseId ? `${baseId}_${idx + 1}` : `claim-row-${idx + 1}`,
                voucherNumber: baseId.startsWith('VCH-') ? baseId : (r.voucherNumber || `VCH-2026-${String(idx + 1).padStart(4, '0')}`),
                routeId: r.Ruta || 'RUTA-1',
                vendorName: r.Vendedor || '',
                clientName: r.Cliente || 'Cliente',
                invoiceNumber: String(r.Factura || 'S/F'),
                deliveryPerson: r.Piloto || 'Piloto Asignado',
                productName: r.Producto || 'Producto General',
                reason: r.Motivo || 'Defecto de Fábrica',
                formattedDate: r.Fecha || new Date().toLocaleDateString('es-GT'),
                formattedTime: r.Hora || '00:00',
                vendorSignature: r.FirmaVendedor || '',
                clientSignature: r.FirmaCliente || '',
                quantity: Number(r.quantity) || 1,
                unit: r.unit || 'Unidades',
                status: r.status || 'Cambio Realizado',
                createdAt: new Date().toISOString(),
                syncedToCloud: true
              } as ProductClaim;
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Direct client webhook fetch error:', e);
  }

  return [];
}

/**
 * Triggers full synchronization of all claims via the backend.
 */
export async function syncAllClaimsViaBackend(): Promise<{
  success: boolean;
  count: number;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/sheets/sync', { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, count: 0, error: err.error || err.message || res.statusText };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message };
  }
}

/**
 * PHYSICALLY DELETES A ROW from the "RECLAMOS" sheet by ID_Reclamo.
 */
export async function deleteReclamoFromSheet(
  accessToken: string,
  spreadsheetId: string,
  claimIdOrVoucher: string
): Promise<boolean> {
  try {
    const targetId = extractSpreadsheetId(spreadsheetId);
    // 1. Get spreadsheet metadata to locate numeric sheetId for "RECLAMOS"
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!metaRes.ok) {
      throw new Error('No se pudo eliminar. Verifica los permisos de la base de datos.');
    }

    const metaData = await metaRes.json();
    let reclamosSheetId: number | null = null;

    for (const s of metaData.sheets || []) {
      if ((s.properties?.title || '').trim().toUpperCase() === 'RECLAMOS') {
        reclamosSheetId = s.properties.sheetId;
        break;
      }
    }

    if (reclamosSheetId === null) {
      throw new Error('Hoja RECLAMOS no encontrada en la base de datos.');
    }

    // 2. Read column A and B of RECLAMOS to find exact row index
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/RECLAMOS!A:B`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!readRes.ok) {
      throw new Error('No se pudo eliminar. Verifica los permisos de la base de datos.');
    }

    const readData = await readRes.json();
    const rows: string[][] = readData.values || [];

    let targetRow0Indexed = -1;
    const searchTarget = claimIdOrVoucher.trim().toLowerCase();

    for (let r = 0; r < rows.length; r++) {
      const colA = (rows[r][0] || '').trim().toLowerCase();
      const colB = (rows[r][1] || '').trim().toLowerCase();
      if (colA === searchTarget || colB === searchTarget) {
        targetRow0Indexed = r;
        break;
      }
    }

    if (targetRow0Indexed === -1) {
      console.warn(`Registro ${claimIdOrVoucher} no encontrado en la hoja RECLAMOS.`);
      return true;
    }

    // 3. Issue batchUpdate deleteDimension to physically delete the entire row
    const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}:batchUpdate`;
    const deleteRes = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: reclamosSheetId,
                dimension: 'ROWS',
                startIndex: targetRow0Indexed,
                endIndex: targetRow0Indexed + 1
              }
            }
          }
        ]
      })
    });

    if (!deleteRes.ok) {
      throw new Error('No se pudo eliminar. Verifica los permisos de la base de datos.');
    }

    return true;
  } catch (err: any) {
    console.error('Error deleting from Google Sheet:', err);
    throw new Error('No se pudo eliminar. Verifica los permisos de la base de datos.');
  }
}

/**
 * Robust RFC 4180 CSV parser handling multiline strings and quotes
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some((f) => f.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim() !== '')) {
      rows.push(currentRow);
    }
  }
  return rows;
}

/**
 * Direct public CSV Reader from Google Sheets.
 * Works on ANY device in the world without requiring user authentication.
 */
export async function fetchClaimsFromGoogleSheetsCSV(spreadsheetId = DEFAULT_SPREADSHEET_ID): Promise<ProductClaim[]> {
  const targetId = extractSpreadsheetId(spreadsheetId);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:csv&sheet=RECLAMOS&_t=${Date.now()}`;
  
  const res = await fetch(csvUrl, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  
  if (!res.ok) {
    throw new Error(`Error al leer CSV de Google Sheets: HTTP ${res.status}`);
  }
  
  const text = await res.text();
  const rows = parseCSV(text);
  if (!rows || rows.length <= 1) {
    return [];
  }
  
  const headers = rows[0];
  const headerMap: { [key: string]: number } = {};
  headers.forEach((h, idx) => {
    headerMap[h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')] = idx;
  });

  const claims: ProductClaim[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => c.trim() === '')) continue;
    
    const rawId = (row[headerMap['idreclamo']] || row[0] || '').trim();
    const route = (row[headerMap['ruta']] || row[1] || 'RUTA-1').trim();
    const vendor = (row[headerMap['vendedor']] || row[2] || '').trim();
    const client = (row[headerMap['cliente']] || row[3] || 'Cliente').trim();
    const invoice = (row[headerMap['factura']] || row[4] || 'S/F').trim();
    const pilot = (row[headerMap['piloto']] || row[5] || 'Piloto Asignado').trim();
    const product = (row[headerMap['producto']] || row[6] || 'Producto General').trim();
    const reason = (row[headerMap['motivo']] || row[7] || 'Defecto de Fábrica').trim();
    const date = (row[headerMap['fecha']] || row[8] || '').trim();
    const time = (row[headerMap['hora']] || row[9] || '00:00').trim();
    const vSig = (row[headerMap['firmavendedor']] || row[10] || '').trim();
    const cSig = (row[headerMap['firmacliente'] ?? headerMap['firmaclienete']] || row[11] || '').trim();

    let voucherNumber = rawId;
    if (!voucherNumber || voucherNumber.startsWith('claim-')) {
      voucherNumber = `MYG-REC-${String(i).padStart(4, '0')}`;
    }

    claims.push({
      id: rawId || `claim-${i}`,
      voucherNumber,
      routeId: route,
      vendorName: vendor,
      clientName: client,
      invoiceNumber: invoice,
      deliveryPerson: pilot,
      productName: product,
      reason: reason as ClaimReason,
      formattedDate: date || new Date().toLocaleDateString('es-GT'),
      formattedTime: time || '00:00',
      vendorSignature: vSig,
      clientSignature: cSig,
      quantity: 1,
      unit: 'Unidades',
      status: 'Cambio Realizado',
      createdAt: new Date().toISOString(),
      syncedToCloud: true
    });
  }

  return claims;
}

export const DEFAULT_APPS_SCRIPT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycby4fNAiDUyGMJBxA3omfgJygFwfT7mGUN9ZVHmPGnrcB7MMsXQm9FL7QKt2w8tBWtFN/exec';

/**
 * Direct POST to Google Apps Script Webhook.
 * Writes directly to the Google Sheet from any device.
 * Format matches: { idReclamo, ruta, vendedor, cliente, factura, piloto, producto, motivo, fecha, hora, firmaVendedor, firmaCliente }
 */
export async function sendClaimToGoogleAppsScript(claim: any): Promise<boolean> {
  const webhookUrl = DEFAULT_APPS_SCRIPT_WEBHOOK_URL;
  const idReclamo = claim.voucherNumber || claim.id;
  const ruta = claim.routeId;
  const vendedor = claim.vendorName;
  const cliente = claim.clientName;
  const factura = claim.invoiceNumber;
  const piloto = claim.deliveryPerson;
  const producto = claim.productName;
  const motivo = claim.reason;
  const fecha = claim.formattedDate;
  const hora = claim.formattedTime;
  const firmaVendedor = claim.vendorSignature;
  const firmaCliente = claim.clientSignature;

  const payload = {
    // Exact requested format
    idReclamo,
    ruta,
    vendedor,
    cliente,
    factura,
    piloto,
    producto,
    motivo,
    fecha,
    hora,
    firmaVendedor,
    firmaCliente,

    // Header column compatibility
    ID_Reclamo: idReclamo,
    Ruta: ruta,
    Vendedor: vendedor,
    Cliente: cliente,
    Factura: factura,
    Piloto: piloto,
    Producto: producto,
    Motivo: motivo,
    Fecha: fecha,
    Hora: hora,
    FirmaVendedor: firmaVendedor,
    FirmaCliente: firmaCliente,
    action: 'addReclamo',
    tab: 'RECLAMOS'
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    });
    return true;
  } catch (err) {
    console.warn('Direct Apps Script fetch warning:', err);
    return false;
  }
}

/**
 * Deletes a claim via Google Apps Script Webhook using method doDelete.
 * Sends { idReclamo } to the webhook link.
 */
export async function deleteClaimFromGoogleAppsScript(idReclamo: string): Promise<boolean> {
  const webhookUrl = DEFAULT_APPS_SCRIPT_WEBHOOK_URL;
  const queryUrl = `${webhookUrl}?action=doDelete&method=doDelete&idReclamo=${encodeURIComponent(idReclamo)}`;

  const payload = {
    idReclamo,
    method: 'doDelete',
    action: 'doDelete',
    ID_Reclamo: idReclamo
  };

  try {
    await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      mode: 'no-cors'
    });
    return true;
  } catch (err) {
    console.warn('Direct Apps Script doDelete warning:', err);
    return false;
  }
}


