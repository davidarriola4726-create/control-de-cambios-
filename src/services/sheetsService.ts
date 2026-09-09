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
