import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProductClaim, ActiveTab, UserAccount, AdminAlert } from './types';
import { INITIAL_CLAIMS } from './data/initialData';
import { DEFAULT_USERS } from './data/usersData';
import { Header } from './components/Header';
import { NewClaimForm } from './components/NewClaimForm';
import { VendorFoldersView, normalizeRouteId } from './components/VendorFoldersView';
import { StatisticsView } from './components/StatisticsView';
import { VoucherHistoryTable } from './components/VoucherHistoryTable';
import { VoucherModal } from './components/VoucherModal';
import { AdminAlertsPanel } from './components/AdminAlertsPanel';
import { AdminUsersView } from './components/AdminUsersView';
import { AuthModal } from './components/AuthModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LogoConfigModal } from './components/LogoConfigModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { DEFAULT_LOGO_URL, LOCAL_STORAGE_LOGO_KEY } from './utils/logoUtils';
import { playNewClaimChime } from './utils/audioAlert';
import { getAccessToken } from './services/googleAuth';
import {
  getStoredSpreadsheetId,
  fetchReclamosFromSheet,
  appendReclamoToSheet,
  appendReclamoViaBackend,
  deleteReclamoFromSheet,
  fetchClaimsFromWebhook
} from './services/sheetsService';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  Check,
  AlertTriangle,
  FileCheck,
  HelpCircle,
  X,
  Volume2
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'cambios_reclamaciones_records_v1';
const USER_SESSION_KEY = 'myg_user_session_v1';

export default function App() {
  // Logo State
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LOGO_KEY);
      if (saved && saved.includes('1CXYEzIMay6FRiYLLww9hjbc9xeMk82xi')) {
        return saved;
      }
      localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, DEFAULT_LOGO_URL);
    } catch (e) {
      console.warn('Could not read logo from localStorage:', e);
    }
    return DEFAULT_LOGO_URL;
  });

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(USER_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = DEFAULT_USERS.find(
          (u) =>
            u.username.toUpperCase() === parsed.username?.toUpperCase() ||
            (parsed.routeId && u.routeId === parsed.routeId)
        );
        if (match) {
          const updatedUser = {
            ...parsed,
            displayName: match.displayName,
            vendorName: match.vendorName,
          };
          localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedUser));
          return updatedUser;
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not parse user session:', e);
    }
    // Default to Admin or null (if null, AuthModal appears immediately)
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => !currentUser);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('new-claim');

  // Claims Database State
  const [claims, setClaims] = useState<ProductClaim[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          // Remove any legacy test mock claims and sync vendorName to latest route configuration
          const cleaned = parsed
            .filter(
              (c: any) =>
                !c.id?.startsWith('claim-100') &&
                !c.voucherNumber?.startsWith('VCH-2026-000') &&
                c.clientName !== 'Supermercado La Bendición - Sucursal 1' &&
                c.clientName !== 'Distribuidora San José' &&
                c.clientName !== 'Minisuper El Roble'
            )
            .map((c: ProductClaim) => {
              const matchedRoute = DEFAULT_USERS.find((u) => u.routeId === c.routeId);
              if (matchedRoute && matchedRoute.vendorName) {
                return { ...c, vendorName: matchedRoute.vendorName };
              }
              return c;
            });
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }
    return [];
  });

  // Admin Alerts State
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [activePopupAlert, setActivePopupAlert] = useState<AdminAlert | null>(null);
  const knownAlertIdsRef = useRef<Set<string>>(new Set());
  const initialAlertsLoadedRef = useRef<boolean>(false);

  // Cloud Sync Status
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals & UI helpers
  const [activeVoucher, setActiveVoucher] = useState<ProductClaim | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);
  const [showQuickGuide, setShowQuickGuide] = useState<boolean>(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);

  // Save custom logo handler
  const handleSaveLogo = async (newUrl: string) => {
    try {
      const res = await fetch('/api/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: newUrl }),
      });
      if (res.ok) {
        setLogoUrl(newUrl);
        localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, newUrl);
      }
    } catch (e) {
      console.warn('Could not save logo to server:', e);
      setLogoUrl(newUrl);
      localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, newUrl);
    }
  };

  // Sync Claims with Google Sheets and Server
  const fetchCloudRecords = useCallback(async (force = false) => {
    try {
      setIsSyncing(true);
      // 1. Fetch from server which directly reads from Google Sheets (Webhook / Live / SA)
      const res = await fetch(`/api/records${force ? '?refresh=sheets' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const synced = data.data.map((c: ProductClaim) => {
            const normalizedRoute = normalizeRouteId(c.routeId, c.vendorName);
            const matchedRoute = DEFAULT_USERS.find(
              (u) => u.routeId === normalizedRoute || (c.vendorName && u.vendorName?.toLowerCase() === c.vendorName.toLowerCase())
            );
            return {
              ...c,
              routeId: normalizedRoute,
              vendorName: c.vendorName || matchedRoute?.vendorName || `Vendedor ${normalizedRoute}`
            };
          });
          setClaims(synced);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(synced));
          } catch {}
          setIsCloudSynced(true);
          return;
        }
      }

      // 2. Direct client Google Sheets Webhook fetch as secondary fallback
      const webhookClaims = await fetchClaimsFromWebhook();
      if (webhookClaims && webhookClaims.length > 0) {
        const synced = webhookClaims.map((c: ProductClaim) => {
          const normalizedRoute = normalizeRouteId(c.routeId, c.vendorName);
          const matchedRoute = DEFAULT_USERS.find(
            (u) => u.routeId === normalizedRoute || (c.vendorName && u.vendorName?.toLowerCase() === c.vendorName.toLowerCase())
          );
          return {
            ...c,
            routeId: normalizedRoute,
            vendorName: c.vendorName || matchedRoute?.vendorName || `Vendedor ${normalizedRoute}`
          };
        });
        setClaims(synced);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(synced));
        } catch {}
        setIsCloudSynced(true);
        return;
      }

      // 3. Direct client Google Sheets API fetch if OAuth token is available
      const sheetId = getStoredSpreadsheetId();
      if (sheetId) {
        const token = await getAccessToken().catch(() => null);
        if (token) {
          const sheetClaims = await fetchReclamosFromSheet(token, sheetId).catch(() => []);
          if (sheetClaims && sheetClaims.length > 0) {
            setClaims(sheetClaims);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sheetClaims));
            } catch {}
            setIsCloudSynced(true);
          }
        }
      }
    } catch (err) {
      console.warn('Could not sync cloud records:', err);
      setIsCloudSynced(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Fetch Alerts from Server
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const incoming: AdminAlert[] = data.data;
          setAlerts(incoming);

          // If not first load, check if any alert is brand new
          if (initialAlertsLoadedRef.current) {
            const newAlerts = incoming.filter(
              (a) => !knownAlertIdsRef.current.has(a.id) && !a.read
            );

            if (newAlerts.length > 0) {
              const latest = newAlerts[0];
              setActivePopupAlert(latest);

              // If current user is ADMIN, sound the alert chime!
              if (currentUser?.role === 'ADMIN') {
                playNewClaimChime(0.85);
              }

              // Auto-dismiss popup banner after 12 seconds
              setTimeout(() => {
                setActivePopupAlert((prev) => (prev?.id === latest.id ? null : prev));
              }, 12000);
            }
          }

          // Register all IDs
          incoming.forEach((a) => knownAlertIdsRef.current.add(a.id));
          initialAlertsLoadedRef.current = true;
        }
      }
    } catch (e) {
      // offline silent catch
    }
  }, [currentUser]);

  // Initial load & background polling
  useEffect(() => {
    fetchCloudRecords();
    fetchAlerts();

    // Fetch custom logo from server
    fetch('/api/logo')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data.logoUrl) {
          setLogoUrl(data.logoUrl);
          localStorage.setItem(LOCAL_STORAGE_LOGO_KEY, data.logoUrl);
        }
      })
      .catch(() => {});

    // Poll claims every 10 seconds
    const claimsInterval = setInterval(fetchCloudRecords, 10000);

    // Poll alerts every 4 seconds for immediate admin notification
    const alertsInterval = setInterval(fetchAlerts, 4000);

    return () => {
      clearInterval(claimsInterval);
      clearInterval(alertsInterval);
    };
  }, [fetchCloudRecords, fetchAlerts]);

  // Handle Login
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    try {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Could not save session to localStorage:', e);
    }

    // Default tab based on role
    if (user.role === 'ROUTE') {
      setActiveTab('vendor-folders');
    } else {
      setActiveTab('new-claim');
    }

    // Automatically read all records from Google Sheets upon login
    fetchCloudRecords(true);
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(USER_SESSION_KEY);
    } catch (e) {
      console.warn('Could not clear user session:', e);
    }
    setIsAuthModalOpen(true);
  };

  // Save Claim Handler
  const handleSaveClaim = async (
    claimData: Omit<ProductClaim, 'id' | 'voucherNumber' | 'syncedToCloud'>
  ): Promise<ProductClaim | null> => {
    try {
      let newRecord: ProductClaim;

      try {
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(claimData),
        });

        if (res.ok) {
          const result = await res.json();
          newRecord = result.data;
          setIsCloudSynced(true);
          // Refresh alerts immediately so Admin receives alert without delay
          fetchAlerts();
        } else {
          throw new Error('Server returned non-200');
        }
      } catch (networkErr) {
        setIsCloudSynced(false);
        const currentYear = new Date().getFullYear();
        const existingNums = claims
          .map((c) => {
            const m = c.voucherNumber.match(/VCH-(\d{4})-(\d+)/);
            return m ? parseInt(m[2], 10) : 0;
          })
          .filter((n) => !isNaN(n));
        const nextVal = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
        const padded = String(nextVal).padStart(4, '0');

        newRecord = {
          ...claimData,
          id: `local-${Date.now()}`,
          voucherNumber: `VCH-${currentYear}-${padded}`,
          syncedToCloud: false,
        };

        // If offline fallback, generate local alert if admin is active
        const fallbackAlert: AdminAlert = {
          id: `alert-${Date.now()}`,
          claimId: newRecord.id,
          voucherNumber: newRecord.voucherNumber,
          routeId: newRecord.routeId || 'RUTA-1',
          productName: newRecord.productName,
          clientName: newRecord.clientName,
          timestamp: newRecord.createdAt,
          formattedDateTime: `${newRecord.formattedDate} ${newRecord.formattedTime}`,
          createdAt: newRecord.createdAt,
          read: false,
          message: `NUEVO RECLAMO — ${newRecord.routeId || 'RUTA-1'} | Producto: ${newRecord.productName} | Cliente: ${newRecord.clientName} | Fecha: ${newRecord.formattedDate} ${newRecord.formattedTime}`
        };

        setAlerts((prev) => [fallbackAlert, ...prev]);
        if (currentUser?.role === 'ADMIN') {
          setActivePopupAlert(fallbackAlert);
          playNewClaimChime(0.85);
        }
      }

      // Directly write to Google Sheets (RECLAMOS)
      const sheetId = getStoredSpreadsheetId();
      try {
        const token = await getAccessToken();
        if (token && sheetId) {
          await appendReclamoToSheet(token, sheetId, newRecord);
        } else {
          // Automatic write via Google Service Account on backend
          await appendReclamoViaBackend(newRecord);
        }
      } catch (sheetAppendErr) {
        console.warn('Google Sheets client append warning, trying backend service account:', sheetAppendErr);
        await appendReclamoViaBackend(newRecord).catch(() => {});
      }

      // Update state and localStorage
      const updatedList = [newRecord, ...claims.filter((c) => c.id !== newRecord.id)];
      setClaims(updatedList);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      } catch (storageErr) {
        console.warn('LocalStorage error:', storageErr);
      }

      return newRecord;
    } catch (err: any) {
      console.error('Failed to create claim:', err);
      throw err;
    }
  };

  const handleClaimCreated = (claim: ProductClaim) => {
    setActiveVoucher(claim);
    setIsVoucherModalOpen(true);
  };

  const handleOpenVoucher = (claim: ProductClaim) => {
    setActiveVoucher(claim);
    setIsVoucherModalOpen(true);
  };

  // Mark Alert Read
  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await fetch(`/api/alerts/${alertId}/read`, { method: 'POST' });
    } catch (e) {
      // offline fallback
    }
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    if (activePopupAlert?.id === alertId) {
      setActivePopupAlert(null);
    }
  };

  // Mark All Read
  const handleMarkAllAlertsRead = async () => {
    try {
      await fetch('/api/alerts/mark-all-read', { method: 'POST' });
    } catch (e) {
      // offline fallback
    }
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setActivePopupAlert(null);
  };

  // Delete single claim (physical row deletion in Google Sheets & server)
  const handleDeleteClaim = async (claimId: string) => {
    // 1. If Google Sheets is connected, physically delete the row from RECLAMOS
    const sheetId = getStoredSpreadsheetId();
    if (sheetId) {
      try {
        const token = await getAccessToken();
        if (token) {
          await deleteReclamoFromSheet(token, sheetId, claimId);
        }
      } catch (sheetErr: any) {
        console.error('Google Sheets delete error:', sheetErr);
        throw new Error('No se pudo eliminar. Verifica los permisos de la base de datos.');
      }
    }

    // 2. Immediately update claims state so UI updates instantaneously
    setClaims((prev) => {
      const updated = prev.filter((c) => c.id !== claimId && c.voucherNumber !== claimId);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updated;
    });

    // 3. Remove any associated alert and close active voucher if open
    setAlerts((prev) => prev.filter((a) => a.claimId !== claimId && a.voucherNumber !== claimId));
    if (activeVoucher?.id === claimId || activeVoucher?.voucherNumber === claimId) {
      setActiveVoucher(null);
      setIsVoucherModalOpen(false);
    }

    // 4. Send DELETE to backend to physically wipe it from server database (claims.json)
    try {
      await fetch(`/api/records/${encodeURIComponent(claimId)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not delete claim from backend:', e);
    }
  };

  // Clear all claims for a route folder
  const handleClearRouteClaims = async (routeId: string) => {
    try {
      await fetch(`/api/records/route/${routeId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not clear route claims from backend:', e);
    }
    const updated = claims.filter((c) => {
      const matchRoute = c.routeId === routeId;
      const matchVendor = c.vendorName && c.vendorName.includes(routeId.replace('RUTA-', 'Ruta '));
      const matchDefaultVendor = DEFAULT_USERS.find((u) => u.routeId === routeId)?.vendorName === c.vendorName;
      return !(matchRoute || matchVendor || matchDefaultVendor);
    });
    setClaims(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Floating Popup Alert Banner for Admin (⚠️ NUEVO RECLAMO) */}
      {currentUser?.role === 'ADMIN' && activePopupAlert && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[480px] z-50 animate-bounce-subtle">
          <div className="bg-slate-950 text-white border-2 border-amber-400 rounded-2xl shadow-2xl p-4 sm:p-5 relative overflow-hidden ring-4 ring-amber-400/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl font-bold shrink-0 animate-pulse">
                <BellRing className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                    Alerta en Vivo
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {activePopupAlert.formattedDateTime}
                  </span>
                </div>

                {/* Message format required */}
                <h4 className="text-sm font-bold text-white mt-1 leading-snug">
                  {activePopupAlert.message}
                </h4>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const matched = claims.find(
                        (c) =>
                          c.id === activePopupAlert.claimId ||
                          c.voucherNumber === activePopupAlert.voucherNumber
                      );
                      if (matched) {
                        handleOpenVoucher(matched);
                      }
                      handleMarkAlertRead(activePopupAlert.id);
                    }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Ver Voucher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkAlertRead(activePopupAlert.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Marcar como Leído
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePopupAlert(null)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Sticky con Pestañas Adaptadas al Rol */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCloudSynced={isCloudSynced}
        isSyncing={isSyncing}
        onManualSync={fetchCloudRecords}
        totalClaimsCount={claims.length}
        currentUser={currentUser}
        unreadAlertsCount={unreadAlertsCount}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
        onTestSound={() => playNewClaimChime(0.9)}
        logoUrl={logoUrl}
        onOpenLogoConfig={() => setIsLogoModalOpen(true)}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
      />

      {/* Sub-header Guía Rápida */}
      <div className="no-print bg-slate-900 text-slate-300 text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
            <span className="font-medium text-slate-200">
              {currentUser?.role === 'ADMIN'
                ? '👑 Sesión de Administrador General • Acceso Total a 11 Rutas y Alertas en Vivo'
                : `🛣️ Sesión: ${currentUser?.routeId || 'Ruta'} • Vendedor: ${currentUser?.vendorName || 'Asignado'}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowQuickGuide(!showQuickGuide)}
            className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showQuickGuide ? 'Ocultar Guía' : 'Guía'}</span>
          </button>
        </div>

        {showQuickGuide && (
          <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-slate-800 text-slate-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 animate-fade-in">
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
              <span className="text-emerald-400 font-bold block mb-0.5">1. Acceso por Ruta 🛣️</span>
              <p className="text-[11px] text-slate-400">
                Cada usuario es dirigido automáticamente a su carpeta exclusiva. Solo ve y trabaja sobre sus propios reclamos.
              </p>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
              <span className="text-emerald-400 font-bold block mb-0.5">2. Firmas Digitales ✍️</span>
              <p className="text-[11px] text-slate-400">
                Llene los 8 campos obligatorios y dibuje las firmas digitales del vendedor y del cliente en pantalla.
              </p>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
              <span className="text-emerald-400 font-bold block mb-0.5">3. Alerta Instantánea 🚨</span>
              <p className="text-[11px] text-slate-400">
                Al registrar un reclamo, el Administrador recibe de inmediato una notificación emergente y un sonido de alerta.
              </p>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
              <span className="text-emerald-400 font-bold block mb-0.5">4. Voucher y PDF 🧾</span>
              <p className="text-[11px] text-slate-400">
                Genera consecutivo oficial único con botón listo para imprimir o guardar en PDF.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {currentUser ? (
          <AnimatePresence mode="wait">
            {activeTab === 'new-claim' && (
              <motion.div
                key="new-claim"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <NewClaimForm
                  currentUser={currentUser}
                  onSaveClaim={handleSaveClaim}
                  onClaimCreated={handleClaimCreated}
                  onGoToFolders={() => setActiveTab('vendor-folders')}
                />
              </motion.div>
            )}

            {activeTab === 'vendor-folders' && (
              <motion.div
                key="vendor-folders"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <VendorFoldersView
                  claims={claims}
                  currentUser={currentUser}
                  onOpenVoucher={handleOpenVoucher}
                  onDeleteClaim={handleDeleteClaim}
                  onClearRouteClaims={handleClearRouteClaims}
                  onRefreshCloudRecords={() => fetchCloudRecords(true)}
                  isSyncing={isSyncing}
                />
              </motion.div>
            )}

            {activeTab === 'statistics' && (
              <motion.div
                key="statistics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <StatisticsView claims={claims} currentUser={currentUser} />
              </motion.div>
            )}

            {activeTab === 'voucher-history' && (
              <motion.div
                key="voucher-history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <VoucherHistoryTable
                  claims={claims}
                  currentUser={currentUser}
                  onOpenVoucher={handleOpenVoucher}
                  onNewClaim={() => setActiveTab('new-claim')}
                  onDeleteClaim={handleDeleteClaim}
                />
              </motion.div>
            )}

            {activeTab === 'admin-alerts' && currentUser.role === 'ADMIN' && (
              <motion.div
                key="admin-alerts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <AdminAlertsPanel
                  alerts={alerts}
                  claims={claims}
                  onOpenVoucher={handleOpenVoucher}
                  onMarkRead={handleMarkAlertRead}
                  onMarkAllRead={handleMarkAllAlertsRead}
                />
              </motion.div>
            )}

            {activeTab === 'admin-users' && currentUser.role === 'ADMIN' && (
              <motion.div
                key="admin-users"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <AdminUsersView currentUser={currentUser} />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <FileCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Inicie sesión para acceder al sistema</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Debe ingresar con su usuario de ruta o cuenta de administrador.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Iniciar Sesión
            </button>
          </div>
        )}
      </main>

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onLoginSuccess={handleLoginSuccess}
        canClose={!!currentUser}
        onClose={() => setIsAuthModalOpen(false)}
        logoUrl={logoUrl}
      />

      {/* Modal de Cambio de Contraseña */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          currentUser={currentUser}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}

      {/* Modal de Voucher Oficial */}
      <VoucherModal
        claim={activeVoucher}
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        logoUrl={logoUrl}
      />

      {/* Modal de Personalización de Logo */}
      <LogoConfigModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentLogoUrl={logoUrl}
        onSaveLogo={handleSaveLogo}
      />

      {/* Modal de Base de Datos Google Sheets */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        onConnected={() => {
          fetchCloudRecords();
        }}
      />

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Control de Cambios y Reclamaciones de Productos MYG • Acceso Seguro por Ruta y Notificaciones al Administrador
          </span>
          <span className="text-[11px] text-slate-400">
            11 Rutas Operativas • Respaldo en la Nube y Local
          </span>
        </div>
      </footer>
    </div>
  );
}
