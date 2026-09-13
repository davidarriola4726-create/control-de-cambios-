import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  appendClaimToGoogleSheets,
  syncAllClaimsToGoogleSheets,
  readAllClaimsFromGoogleSheets,
  normalizeRoute,
  testGoogleSheetsStatus,
  isGoogleSheetsConfigured,
  getWebhookUrl,
  DEFAULT_SHEET_ID,
  DEFAULT_TAB_NAME,
  SHEET_NAME_TITLE,
  RECLAMOS_COLUMNS
} from './server/googleSheets';

const app = express();
const PORT = 3000;

// Increase limit to accommodate digital signature canvas base64 images
app.use(express.json({ limit: '15mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'claims.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const LOGO_FILE = path.join(DATA_DIR, 'logo.json');
const DELETED_IDS_FILE = path.join(DATA_DIR, 'deleted_ids.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getStoredDeletedIds(): string[] {
  try {
    if (fs.existsSync(DELETED_IDS_FILE)) {
      const data = fs.readFileSync(DELETED_IDS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading deleted_ids.json:', err);
  }
  return [];
}

function saveDeletedId(id: string) {
  try {
    const list = getStoredDeletedIds();
    const cleanId = id.trim().toUpperCase();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error saving deleted ID:', err);
  }
}

// Default initial users exactly as specified in the prompt
const DEFAULT_INITIAL_USERS = [
  {
    id: 'user-admin',
    username: 'Admin',
    displayName: 'Administrador General MYG',
    role: 'ADMIN',
    vendorName: 'Administración Central',
    password: 'Mg2026',
    lastLogin: '05/09/2026 21:00'
  },
  {
    id: 'user-ruta-1',
    username: 'RUTA-1',
    displayName: 'Brian Gómez',
    role: 'ROUTE',
    routeId: 'RUTA-1',
    vendorName: 'Brian Gómez',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-2',
    username: 'RUTA-2',
    displayName: 'Melvin Sequeen',
    role: 'ROUTE',
    routeId: 'RUTA-2',
    vendorName: 'Melvin Sequeen',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-3',
    username: 'RUTA-3',
    displayName: 'Mel Marvin Gómez',
    role: 'ROUTE',
    routeId: 'RUTA-3',
    vendorName: 'Mel Marvin Gómez',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-4',
    username: 'RUTA-4',
    displayName: 'Marcos Juárez',
    role: 'ROUTE',
    routeId: 'RUTA-4',
    vendorName: 'Marcos Juárez',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-5',
    username: 'RUTA-5',
    displayName: 'Vendedor Ruta 5',
    role: 'ROUTE',
    routeId: 'RUTA-5',
    vendorName: 'Vendedor Ruta 5',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-6',
    username: 'RUTA-6',
    displayName: 'Gustavo Gómez',
    role: 'ROUTE',
    routeId: 'RUTA-6',
    vendorName: 'Gustavo Gómez',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-7',
    username: 'RUTA-7',
    displayName: 'Ruta 7',
    role: 'ROUTE',
    routeId: 'RUTA-7',
    vendorName: 'Ruta 7',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-8',
    username: 'RUTA-8',
    displayName: 'Marvin Otoniel',
    role: 'ROUTE',
    routeId: 'RUTA-8',
    vendorName: 'Marvin Otoniel',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-9',
    username: 'RUTA-9',
    displayName: 'Sergio Catú',
    role: 'ROUTE',
    routeId: 'RUTA-9',
    vendorName: 'Sergio Catú',
    password: 'Mmig'
  },
  {
    id: 'user-ruta-10',
    username: 'RUTA-10',
    displayName: 'Edgar Guzmán',
    role: 'ROUTE',
    routeId: 'RUTA-10',
    vendorName: 'Edgar Guzmán',
    password: 'Mgyg'
  },
  {
    id: 'user-ruta-11',
    username: 'RUTA-11',
    displayName: 'Esaú Osorio',
    role: 'ROUTE',
    routeId: 'RUTA-11',
    vendorName: 'Esaú Osorio',
    password: 'Mgyg'
  }
];

// Helper functions for persistent storage
function getStoredUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Synchronize vendorName and displayName with DEFAULT_INITIAL_USERS while preserving passwords and lastLogin
        const synchronized = parsed.map((u) => {
          const match = DEFAULT_INITIAL_USERS.find(
            (d) =>
              d.username.toUpperCase() === u.username?.toUpperCase() ||
              (d.routeId && u.routeId && d.routeId === u.routeId)
          );
          if (match) {
            return {
              ...u,
              displayName: match.displayName,
              vendorName: match.vendorName,
            };
          }
          return u;
        });
        saveUsers(synchronized);
        return synchronized;
      }
    }
  } catch (err) {
    console.error('Error reading users.json:', err);
  }
  // Initialize default file
  saveUsers(DEFAULT_INITIAL_USERS);
  return DEFAULT_INITIAL_USERS;
}

function saveUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users.json:', err);
  }
}

function getStoredClaims(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading claims.json:', err);
  }
  return [];
}

function saveClaims(claims: any[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(claims, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing claims.json:', err);
  }
}

function getStoredAlerts(): any[] {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading alerts.json:', err);
  }
  return [];
}

function saveAlerts(alerts: any[]) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing alerts.json:', err);
  }
}

function getStoredLogo(): string {
  try {
    if (fs.existsSync(LOGO_FILE)) {
      const data = fs.readFileSync(LOGO_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.logoUrl) return parsed.logoUrl;
    }
  } catch (err) {
    console.error('Error reading logo.json:', err);
  }
  return 'https://drive.google.com/uc?export=view&id=1CXYEzIMay6FRiYLLww9hjbc9xeMk82xi';
}

function saveLogo(logoUrl: string) {
  try {
    fs.writeFileSync(LOGO_FILE, JSON.stringify({ logoUrl }, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing logo.json:', err);
  }
}

// Health check endpoint for cloud connection indicator
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), cloudSync: true });
});

// Logo endpoints
app.get('/api/logo', (req, res) => {
  const logoUrl = getStoredLogo();
  res.json({ success: true, logoUrl });
});

app.post('/api/logo', (req, res) => {
  const { logoUrl } = req.body;
  if (!logoUrl) {
    return res.status(400).json({ success: false, message: 'URL o imagen de logo requerida' });
  }
  saveLogo(logoUrl);
  res.json({ success: true, logoUrl });
});

// =================== AUTH & USER MANAGEMENT ===================

// Login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }

    const users = getStoredUsers();
    // Case-insensitive match for username (accepts ruta-1, RUTA-1, admin, ADMIN, etc.)
    const user = users.find(
      (u) => u.username.trim().toUpperCase() === username.trim().toUpperCase()
    );

    const inputPass = password.trim();
    const inputPassLower = inputPass.toLowerCase();
    const userPassLower = (user?.password || '').toLowerCase();

    // Enable uppercase, lowercase and specific passwords:
    // Admin: MYG2026 or Mg2026
    // Routes: myg, Mgyg, Mmig
    const passwordMatches = user && (
      user.password === inputPass ||
      userPassLower === inputPassLower ||
      (user.role === 'ADMIN' && (inputPassLower === 'myg2026' || inputPassLower === 'mg2026')) ||
      (user.role === 'ROUTE' && (inputPassLower === 'myg' || inputPassLower === 'mgyg' || inputPassLower === 'mmig'))
    );

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos. Verifique sus credenciales.'
      });
    }

    // Update lastLogin
    user.lastLogin = new Date().toLocaleString('es-GT', {
      timeZone: 'America/Guatemala',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    saveUsers(users);

    // Return sanitized user object
    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all users (for Admin dashboard or route list)
app.get('/api/users', (req, res) => {
  const users = getStoredUsers();
  // Safe list without passwords by default unless requested with query
  const safeUsers = users.map((u) => {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      routeId: u.routeId,
      vendorName: u.vendorName,
      lastLogin: u.lastLogin,
      hasPassword: Boolean(u.password)
    };
  });
  res.json({ success: true, data: safeUsers });
});

// Change user password (from user's own session or admin)
app.post('/api/users/change-password', (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    const users = getStoredUsers();
    const user = users.find(
      (u) => u.username.trim().toUpperCase() === username.trim().toUpperCase()
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // If currentPassword is provided, verify it with uppercase and lowercase flexibility
    if (currentPassword) {
      const matchCurrent =
        user.password === currentPassword.trim() ||
        user.password.toLowerCase() === currentPassword.trim().toLowerCase();
      if (!matchCurrent) {
        return res.status(401).json({ success: false, message: 'La contraseña actual no coincide' });
      }
    }

    user.password = newPassword.trim();
    saveUsers(users);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin reset password endpoint
app.post('/api/users/reset-password', (req, res) => {
  try {
    const { targetUsername, newPassword, adminUsername, adminPassword } = req.body;
    const users = getStoredUsers();
    const admin = users.find((u) => u.username.toUpperCase() === 'ADMIN');
    const adminPassMatches =
      admin &&
      (admin.password === adminPassword.trim() ||
        admin.password.toLowerCase() === adminPassword.trim().toLowerCase());
    if (!admin || !adminPassMatches) {
      return res.status(403).json({ success: false, message: 'No autorizado como Administrador' });
    }

    const targetUser = users.find(
      (u) => u.username.trim().toUpperCase() === targetUsername.trim().toUpperCase()
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Ruta o usuario no encontrado' });
    }

    targetUser.password = newPassword.trim();
    saveUsers(users);

    res.json({ success: true, message: `Contraseña de ${targetUser.username} restablecida con éxito` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =================== CLAIMS & RECORDS ===================

// GET all records - automatically reads all records from Google Sheets (Webhook / Live / SA)
app.get('/api/records', async (req, res) => {
  try {
    const deletedIds = new Set(getStoredDeletedIds());
    const localClaims = getStoredClaims().filter((c: any) => {
      const v = (c.voucherNumber || '').trim().toUpperCase();
      const id = (c.id || '').trim().toUpperCase();
      return !deletedIds.has(v) && !deletedIds.has(id);
    });

    const sheetsResult = await readAllClaimsFromGoogleSheets();

    if (sheetsResult.success && Array.isArray(sheetsResult.data) && sheetsResult.data.length > 0) {
      const sheetsClaims = sheetsResult.data.filter((c: any) => {
        const v = (c.voucherNumber || '').trim().toUpperCase();
        const id = (c.id || '').trim().toUpperCase();
        return !deletedIds.has(v) && !deletedIds.has(id);
      });

      // Index local claims by ID and voucher to preserve full local base64 signatures
      const localMap = new Map<string, any>();
      localClaims.forEach((c: any) => {
        if (c.voucherNumber) localMap.set(c.voucherNumber, c);
        if (c.id) localMap.set(c.id, c);
      });

      // Claims read from Google Sheets are the definitive record list, deduplicated
      const dedupeMap = new Map<string, any>();
      sheetsClaims.forEach((c: any) => {
        const key = (c.voucherNumber || c.id || '').trim().toUpperCase();
        if (!key || deletedIds.has(key)) return;
        if (!dedupeMap.has(key)) {
          const local = localMap.get(c.voucherNumber) || localMap.get(c.id);
          dedupeMap.set(key, {
            ...c,
            vendorSignature: (c.vendorSignature && !c.vendorSignature.startsWith('['))
              ? c.vendorSignature
              : (local?.vendorSignature || c.vendorSignature),
            clientSignature: (c.clientSignature && !c.clientSignature.startsWith('['))
              ? c.clientSignature
              : (local?.clientSignature || c.clientSignature),
          });
        }
      });

      const finalClaims = Array.from(dedupeMap.values());
      saveClaims(finalClaims);

      return res.json({
        success: true,
        count: finalClaims.length,
        data: finalClaims,
        source: sheetsResult.source
      });
    }

    // Deduplicate local claims as fallback
    const dedupeLocalMap = new Map<string, any>();
    localClaims.forEach((c: any) => {
      const key = (c.voucherNumber || c.id || '').trim().toUpperCase();
      if (!key || deletedIds.has(key)) return;
      if (!dedupeLocalMap.has(key)) {
        dedupeLocalMap.set(key, c);
      }
    });
    const finalLocalClaims = Array.from(dedupeLocalMap.values());

    res.json({
      success: true,
      count: finalLocalClaims.length,
      data: finalLocalClaims,
      source: 'local-cache'
    });
  } catch (err: any) {
    console.error('[GET /api/records] Error reading records:', err);
    const deletedIds = new Set(getStoredDeletedIds());
    const localClaims = getStoredClaims().filter((c: any) => {
      const v = (c.voucherNumber || '').trim().toUpperCase();
      const id = (c.id || '').trim().toUpperCase();
      return !deletedIds.has(v) && !deletedIds.has(id);
    });
    res.json({
      success: true,
      count: localClaims.length,
      data: localClaims,
      source: 'local-fallback'
    });
  }
});

// GET webhook URL for client-side direct calls
app.get('/api/webhook/url', (req, res) => {
  const webhookUrl = getWebhookUrl();
  res.json({ success: Boolean(webhookUrl), webhookUrl });
});

// GET direct read from Google Sheets with diagnostics
app.get('/api/sheets/read', async (req, res) => {
  try {
    const result = await readAllClaimsFromGoogleSheets();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST a new claim record with auto-consecutive voucher number and admin alert
app.post('/api/records', async (req, res) => {
  try {
    const claims = getStoredClaims();
    const newRecord = req.body;

    // Check if ID or voucher number already exists (prevent duplicates)
    const targetVoucher = (newRecord.voucherNumber || '').trim().toUpperCase();
    const targetId = (newRecord.id || '').trim().toUpperCase();

    if (targetVoucher || targetId) {
      const alreadyExists = claims.some((c: any) => {
        const cVouch = (c.voucherNumber || '').trim().toUpperCase();
        const cId = (c.id || '').trim().toUpperCase();
        return (targetVoucher && cVouch === targetVoucher) || (targetId && cId === targetId);
      });

      if (alreadyExists) {
        return res.status(409).json({
          success: false,
          message: '⚠️ Ya existe'
        });
      }
    }

    // Calculate next consecutive voucher if not provided (Format: MYG-REC-XXXX)
    if (!newRecord.voucherNumber) {
      const existingVouchers = claims
        .map((c: any) => {
          const match = c.voucherNumber?.match(/(?:MYG-REC-|VCH-)?(?:(\d{4})-)?(\d+)/i);
          return match ? parseInt(match[2] || match[1], 10) : 0;
        })
        .filter((n: number) => !isNaN(n));

      const maxNum = existingVouchers.length > 0 ? Math.max(...existingVouchers) : 0;
      const nextNum = String(maxNum + 1).padStart(4, '0');
      newRecord.voucherNumber = `MYG-REC-${nextNum}`;
    }

    if (!newRecord.id) {
      newRecord.id = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    newRecord.syncedToCloud = true;
    newRecord.updatedAt = new Date().toISOString();

    // Default routeId if missing
    if (!newRecord.routeId) {
      newRecord.routeId = 'RUTA-1';
    }

    // Prepend new claim
    claims.unshift(newRecord);
    saveClaims(claims);

    // 🚨 CREATE REAL-TIME ALERT FOR THE ADMINISTRATOR
    const now = new Date();
    const formattedDateTime = `${newRecord.formattedDate || now.toLocaleDateString('es-GT')} ${newRecord.formattedTime || now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
    
    // Required message format:
    // "NUEVO RECLAMO — [Número de Ruta] | Producto: [Nombre] | Cliente: [Nombre] | Fecha: [Fecha y Hora]"
    const alertMessage = `NUEVO RECLAMO — ${newRecord.routeId} | Producto: ${newRecord.productName} | Cliente: ${newRecord.clientName} | Fecha: ${formattedDateTime}`;

    const newAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      claimId: newRecord.id,
      voucherNumber: newRecord.voucherNumber,
      routeId: newRecord.routeId,
      productName: newRecord.productName,
      clientName: newRecord.clientName,
      timestamp: new Date().toISOString(),
      formattedDateTime,
      message: alertMessage,
      read: false
    };

    const alerts = getStoredAlerts();
    alerts.unshift(newAlert);
    saveAlerts(alerts);

    // 📊 AUTO-APPEND DIRECTLY TO GOOGLE SHEETS VIA SERVICE ACCOUNT
    let sheetsSync = { success: false, attempted: false, message: '' };
    if (isGoogleSheetsConfigured()) {
      try {
        sheetsSync.attempted = true;
        const sheetResult = await appendClaimToGoogleSheets(newRecord);
        sheetsSync = { ...sheetsSync, ...sheetResult, attempted: true };
        if (sheetResult.success) {
          newRecord.syncedToGoogleSheets = true;
          // Update stored claim with sync flag
          saveClaims(claims);
        }
      } catch (sheetsErr: any) {
        console.warn('[GoogleSheets Auto-Append Error]:', sheetsErr.message);
        sheetsSync.message = sheetsErr.message;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Registro y voucher generados exitosamente',
      data: newRecord,
      alert: newAlert,
      sheetsSync
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== ADMIN ALERTS ENDPOINTS ===================

// GET all alerts (for administrator panel)
app.get('/api/alerts', (req, res) => {
  const alerts = getStoredAlerts();
  const unreadCount = alerts.filter((a) => !a.read).length;
  res.json({
    success: true,
    count: alerts.length,
    unreadCount,
    data: alerts
  });
});

// Mark single alert as read
app.post('/api/alerts/:id/read', (req, res) => {
  const { id } = req.params;
  const alerts = getStoredAlerts();
  const alert = alerts.find((a) => a.id === id);
  if (alert) {
    alert.read = true;
    saveAlerts(alerts);
  }
  res.json({ success: true, data: alert });
});

// Mark all alerts as read
app.post('/api/alerts/mark-all-read', (req, res) => {
  const alerts = getStoredAlerts();
  alerts.forEach((a) => {
    a.read = true;
  });
  saveAlerts(alerts);
  res.json({ success: true, count: alerts.length });
});

// Delete alert
app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  let alerts = getStoredAlerts();
  alerts = alerts.filter((a) => a.id !== id);
  saveAlerts(alerts);
  res.json({ success: true, message: 'Alerta eliminada' });
});

// Clear all alerts
app.delete('/api/alerts', (req, res) => {
  saveAlerts([]);
  res.json({ success: true, message: 'Todas las alertas eliminadas' });
});

// PUT update claim
app.put('/api/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    const claims = getStoredClaims();
    const index = claims.findIndex((c: any) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    claims[index] = { ...claims[index], ...req.body, updatedAt: new Date().toISOString() };
    saveClaims(claims);

    res.json({ success: true, data: claims[index] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE claim physically and permanently
app.delete('/api/records/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const decodedId = decodeURIComponent(rawId);

    // Track permanently deleted ID to avoid re-adding or duplicating from sheets cache
    saveDeletedId(rawId);
    saveDeletedId(decodedId);

    let claims = getStoredClaims();
    claims = claims.filter((c: any) => {
      const matchId = c.id === rawId || c.id === decodedId;
      const matchVoucher = c.voucherNumber === rawId || c.voucherNumber === decodedId;
      return !(matchId || matchVoucher);
    });
    saveClaims(claims);

    // Also remove any matching alert
    let alerts = getStoredAlerts();
    alerts = alerts.filter((a: any) => {
      const matchId = a.claimId === rawId || a.claimId === decodedId;
      const matchVoucher = a.voucherNumber === rawId || a.voucherNumber === decodedId;
      return !(matchId || matchVoucher);
    });
    saveAlerts(alerts);

    // Forward doDelete to Google Apps Script Webhook with POST
    const webhookUrl = getWebhookUrl();
    if (webhookUrl) {
      try {
        const queryUrl = `${webhookUrl}?action=delete&method=doDelete&idReclamo=${encodeURIComponent(decodedId)}`;
        await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idReclamo: decodedId,
            action: 'delete',
            method: 'doDelete',
            ID_Reclamo: decodedId
          }),
          redirect: 'follow'
        });
      } catch (scriptErr) {
        console.warn('Apps Script delete server warning:', scriptErr);
      }
    }

    res.json({ success: true, message: '✅ Borrado' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE all claims for a route
app.delete('/api/records/route/:routeId', (req, res) => {
  try {
    const { routeId } = req.params;
    let claims = getStoredClaims();
    const initialLen = claims.length;
    claims = claims.filter((c: any) => {
      const matchRoute = c.routeId === routeId;
      const matchVendor = c.vendorName && c.vendorName.includes(routeId.replace('RUTA-', 'Ruta '));
      return !(matchRoute || matchVendor);
    });
    saveClaims(claims);
    res.json({ success: true, message: `Registros de ${routeId} eliminados`, deletedCount: initialLen - claims.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seed endpoint - system starts completely empty as requested
app.post('/api/records/seed', (req, res) => {
  res.json({ success: true, count: 0, message: 'Sistema limpio sin datos de prueba' });
});

// =================== GOOGLE SHEETS SERVICE ACCOUNT ENDPOINTS ===================

// GET status and diagnostics of Google Sheets connection
app.get('/api/sheets/status', async (req, res) => {
  try {
    const status = await testGoogleSheetsStatus();
    res.json({
      success: true,
      defaultSheetId: DEFAULT_SHEET_ID,
      defaultTab: DEFAULT_TAB_NAME,
      sheetNameTitle: SHEET_NAME_TITLE,
      columns: RECLAMOS_COLUMNS,
      ...status
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST append single claim to Google Sheets
app.post('/api/sheets/append', async (req, res) => {
  try {
    const claim = req.body;
    if (!claim || !claim.id) {
      return res.status(400).json({ success: false, message: 'Reclamo inválido o incompleto' });
    }
    const result = await appendClaimToGoogleSheets(claim);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST sync all stored claims to Google Sheets
app.post('/api/sheets/sync', async (req, res) => {
  try {
    const claims = getStoredClaims();
    const result = await syncAllClaimsToGoogleSheets(claims);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor de Control de Cambios MYG activo en http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
