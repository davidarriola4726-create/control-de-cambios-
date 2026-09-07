import { ProductClaim, UserAccount, ClaimReason, ClaimStatus } from '../types';
import { DEFAULT_USERS } from '../data/usersData';

export const LOCAL_STORAGE_SHEET_KEY = 'myg_google_sheets_spreadsheet_id';

/**
 * Extracts the Google Spreadsheet ID from either a full URL or a raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
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
  return trimmed;
}

export function getStoredSpreadsheetId(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_SHEET_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSpreadsheetId(id: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, id);
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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
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
    spreadsheetTitle: data.properties?.title || 'Google Sheet',
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
          gridProperties: { rowCount: 1000, columnCount: 15 }
        }
      }
    });
  }

  if (requests.length > 0) {
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
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
      const err = await batchRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'No se pudieron crear las hojas requeridas.');
    }
  }

  // Populate USUARIOS header and default users if needed
  if (needUsuarios) {
    const usuariosValues = [
      ['ID', 'TipoUsuario', 'NombreRuta', 'Contraseña', 'NombreVendedor', 'Estado'],
      ...DEFAULT_USERS.map((u) => [
        u.id,
        u.role === 'ADMIN' ? 'Administrador' : 'Usuario',
        u.username,
        u.password || 'Mgyg',
        u.vendorName,
        'Activo'
      ])
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!A1:F${usuariosValues.length}?valueInputOption=USER_ENTERED`,
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

  // Populate RECLAMOS headers (leaving data empty as required)
  if (needReclamos) {
    const reclamosHeaders = [
      [
        'ID_Reclamo',
        'N_Voucher',
        'FechaHora',
        'NombreRuta',
        'NombreVendedor',
        'Cliente',
        'Factura',
        'Piloto',
        'Producto',
        'Motivo',
        'FirmaVendedor',
        'FirmaCliente',
        'Estado'
      ]
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RECLAMOS!A1:M1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: reclamosHeaders })
      }
    );
  }
}

/**
 * Reads users from the "USUARIOS" sheet.
 * Format: ID, TipoUsuario, NombreRuta, Contraseña, NombreVendedor, Estado
 */
export async function fetchUsuariosFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<UserAccount[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!A1:F100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('No se pudo leer la hoja USUARIOS.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) {
    return [];
  }

  const users: UserAccount[] = [];

  // Skip row 0 (headers)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const id = row[0]?.trim() || `USR-${i}`;
    const tipoUsuario = (row[1] || '').trim();
    const nombreRuta = (row[2] || '').trim();
    const contrasena = (row[3] || '').trim();
    const nombreVendedor = (row[4] || '').trim();
    const estado = (row[5] || 'Activo').trim();

    const isAdmin =
      tipoUsuario.toLowerCase().includes('admin') ||
      nombreRuta.toLowerCase() === 'admin';

    users.push({
      id,
      username: nombreRuta,
      displayName: isAdmin ? 'Administrador MYG' : `${nombreVendedor} (${nombreRuta})`,
      role: isAdmin ? 'ADMIN' : 'ROUTE',
      routeId: isAdmin ? undefined : nombreRuta,
      vendorName: nombreVendedor || nombreRuta,
      password: contrasena,
      lastLogin: estado === 'Activo' ? 'Activo' : 'Inactivo'
    });
  }

  return users;
}

/**
 * Updates a user's password directly in the USUARIOS sheet.
 */
export async function updateUserPasswordInSheet(
  accessToken: string,
  spreadsheetId: string,
  username: string,
  newPassword: string
): Promise<boolean> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!A1:F100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('No se pudo acceder a la hoja USUARIOS para actualizar la contraseña.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[2]?.trim().toLowerCase() === username.trim().toLowerCase()) {
      targetRowIndex = i + 1; // 1-indexed for Sheets A1 notation
      break;
    }
  }

  if (targetRowIndex === -1) {
    throw new Error(`Usuario "${username}" no encontrado en la hoja USUARIOS.`);
  }

  // Update cell D{targetRowIndex}
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USUARIOS!D${targetRowIndex}?valueInputOption=USER_ENTERED`;
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[newPassword]]
    })
  });

  if (!updateRes.ok) {
    throw new Error('Error al guardar la nueva contraseña en Google Sheets.');
  }

  return true;
}

/**
 * Reads claims from the "RECLAMOS" sheet.
 * Format:
 * [ID_Reclamo, N_Voucher, FechaHora, NombreRuta, NombreVendedor, Cliente, Factura, Piloto, Producto, Motivo, FirmaVendedor, FirmaCliente, Estado]
 */
export async function fetchReclamosFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<ProductClaim[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RECLAMOS!A1:M1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('No se pudo leer la hoja RECLAMOS de Google Sheets.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) {
    // Sheet is empty or only has headers
    return [];
  }

  const claims: ProductClaim[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]?.trim()) continue;

    const id = row[0]?.trim() || `REC-${i}`;
    const voucherNumber = row[1]?.trim() || `VCH-${id}`;
    const fechaHora = (row[2] || '').trim();
    const routeId = (row[3] || 'RUTA-1').trim();
    const vendorName = (row[4] || '').trim();
    const clientName = (row[5] || '').trim();
    const invoiceNumber = (row[6] || '').trim();
    const deliveryPerson = (row[7] || '').trim();
    const productName = (row[8] || '').trim();
    const reason = (row[9] || 'Defecto de Fábrica').trim() as ClaimReason;
    const vendorSignature = (row[10] || '').trim();
    const clientSignature = (row[11] || '').trim();
    const status = (row[12] || 'Cambio Realizado').trim() as ClaimStatus;

    // Parse date and time if available
    let formattedDate = '05/09/2026';
    let formattedTime = '12:00';
    if (fechaHora.includes(' ')) {
      const parts = fechaHora.split(' ');
      formattedDate = parts[0] || formattedDate;
      formattedTime = parts[1] || formattedTime;
    } else if (fechaHora) {
      formattedDate = fechaHora;
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
 * Appends a new claim to the "RECLAMOS" sheet.
 */
export async function appendReclamoToSheet(
  accessToken: string,
  spreadsheetId: string,
  claim: ProductClaim
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RECLAMOS!A:M:append?valueInputOption=USER_ENTERED`;
  const rowValues = [
    claim.id,
    claim.voucherNumber,
    `${claim.formattedDate} ${claim.formattedTime}`,
    claim.routeId,
    claim.vendorName,
    claim.clientName,
    claim.invoiceNumber,
    claim.deliveryPerson,
    claim.productName,
    claim.reason,
    claim.vendorSignature,
    claim.clientSignature,
    claim.status
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
 * PHYSICALLY DELETES A ROW from the "RECLAMOS" sheet by ID_Reclamo or voucherNumber.
 * If cannot connect or fails, throws "No se pudo eliminar. Verifica los permisos de la base de datos."
 */
export async function deleteReclamoFromSheet(
  accessToken: string,
  spreadsheetId: string,
  claimIdOrVoucher: string
): Promise<boolean> {
  try {
    // 1. Get spreadsheet metadata to locate numeric sheetId for "RECLAMOS"
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
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
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RECLAMOS!A:B`;
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
      // If row not found in sheets, it might already have been deleted or only present locally
      return true;
    }

    // 3. Issue batchUpdate deleteDimension to physically delete the entire row
    const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
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
