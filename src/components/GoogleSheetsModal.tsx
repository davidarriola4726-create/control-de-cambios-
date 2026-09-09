import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  Layers,
  Users,
  Database,
  X,
  LogIn,
  UploadCloud,
  KeyRound,
  Copy,
  Check,
  Table
} from 'lucide-react';
import {
  googleSignIn,
  getAccessToken,
  getCachedGoogleUser,
  logoutGoogle
} from '../services/googleAuth';
import {
  extractSpreadsheetId,
  getStoredSpreadsheetId,
  saveSpreadsheetId,
  inspectSpreadsheet,
  initializeSheetStructure,
  fetchSheetsServerStatus,
  syncAllClaimsViaBackend,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SHEET_TITLE,
  DEFAULT_RECLAMOS_TAB,
  RECLAMOS_COLUMNS,
  SheetConnectionInfo
} from '../services/sheetsService';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionUpdated: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  onConnectionUpdated
}) => {
  const [spreadsheetInput, setSpreadsheetInput] = useState(DEFAULT_SPREADSHEET_ID);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<SheetConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isInitializingSheets, setIsInitializingSheets] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Server-side Service Account status
  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    canAccess: boolean;
    email?: string | null;
    error?: string;
    sheetTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredSpreadsheetId() || DEFAULT_SPREADSHEET_ID;
      setSpreadsheetInput(stored);

      const user = getCachedGoogleUser();
      if (user?.email) {
        setGoogleUserEmail(user.email);
      }

      // Check server service account status
      checkServerSheetsStatus();

      // Test connection if already signed in or stored
      if (stored) {
        handleTestConnection(stored);
      }
    }
  }, [isOpen]);

  const checkServerSheetsStatus = async () => {
    try {
      const res = await fetchSheetsServerStatus();
      setServerStatus(res);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleGoogleConnect = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const authResult = await googleSignIn();
      if (authResult?.user?.email) {
        setGoogleUserEmail(authResult.user.email);
        setSuccessMessage('Sesión iniciada con Google exitosamente.');
        const targetId = extractSpreadsheetId(spreadsheetInput) || DEFAULT_SPREADSHEET_ID;
        if (targetId) {
          await handleTestConnection(targetId, authResult.accessToken);
        }
      }
    } catch (err: any) {
      console.error('Google Sign in error:', err);
      setError('No se pudo conectar la cuenta de Google: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleTestConnection = async (idToTest?: string, tokenOverride?: string) => {
    const raw = idToTest !== undefined ? idToTest : spreadsheetInput;
    const cleanId = extractSpreadsheetId(raw) || DEFAULT_SPREADSHEET_ID;

    setCheckingConnection(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = tokenOverride || (await getAccessToken());

      if (!token) {
        // If no OAuth token in client, refresh server status instead
        await checkServerSheetsStatus();
        setCheckingConnection(false);
        return;
      }

      const info = await inspectSpreadsheet(token, cleanId);
      setConnectionInfo(info);
      saveSpreadsheetId(cleanId);
      setSuccessMessage(`Conexión exitosa con "${info.spreadsheetTitle || DEFAULT_SHEET_TITLE}"`);
      onConnectionUpdated();
    } catch (err: any) {
      console.error('Test connection error:', err);
      setError(
        err.message ||
          'Error al conectar. Asegúrese de que la hoja exista y tenga permisos de lectura/escritura.'
      );
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleInitializeSheets = async () => {
    const cleanId = extractSpreadsheetId(spreadsheetInput) || DEFAULT_SPREADSHEET_ID;
    const token = await getAccessToken();

    if (!token) {
      setError('Debe iniciar sesión con Google para configurar las pestañas.');
      return;
    }

    setIsInitializingSheets(true);
    setError(null);

    try {
      const needUsuarios = !connectionInfo?.hasUsuariosSheet;
      const needReclamos = !connectionInfo?.hasReclamosSheet;

      await initializeSheetStructure(token, cleanId, needUsuarios, needReclamos);
      setSuccessMessage('¡Pestañas RECLAMOS y columnas estructuradas exitosamente!');
      await handleTestConnection(cleanId, token);
      onConnectionUpdated();
    } catch (err: any) {
      setError('Error al crear pestañas: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsInitializingSheets(false);
    }
  };

  const handleSyncAllClaims = async () => {
    setIsSyncingAll(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await syncAllClaimsViaBackend();
      if (result.success) {
        setSuccessMessage(result.message || `Sincronización completada (${result.count} registros).`);
      } else {
        setError(result.error || 'No se pudo sincronizar los reclamos a Google Sheets.');
      }
    } catch (err: any) {
      setError('Error al sincronizar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleDisconnect = async () => {
    await logoutGoogle();
    setGoogleUserEmail(null);
    setConnectionInfo(null);
    setSuccessMessage('Sesión de Google cerrada.');
  };

  const copySheetId = () => {
    navigator.clipboard.writeText(extractSpreadsheetId(spreadsheetInput));
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const activeSheetId = extractSpreadsheetId(spreadsheetInput) || DEFAULT_SPREADSHEET_ID;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                Conexión Oficial a Google Sheets
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                  Base de datos real
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 font-medium">
                Pestaña: <span className="font-bold text-white">{DEFAULT_RECLAMOS_TAB}</span> | 12 Columnas Oficiales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Alerts */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Official Google Sheet Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Hoja de Cálculo Configurada
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {DEFAULT_SHEET_TITLE}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-600 block">
                ID de la Hoja de Google Sheets
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder={DEFAULT_SPREADSHEET_ID}
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={copySheetId}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Copiar ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
                </button>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${activeSheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Hoja</span>
                </a>
              </div>
            </div>

            {/* Columns preview */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Table className="w-3 h-3 text-emerald-600" />
                  Pestaña: <code className="text-emerald-700 font-black">{DEFAULT_RECLAMOS_TAB}</code> (12 Columnas)
                </span>
                <span className="text-[10px] text-slate-400">A1:L1</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RECLAMOS_COLUMNS.map((col, idx) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-mono font-medium text-slate-700"
                  >
                    <span className="text-emerald-600 font-bold mr-1">{String.fromCharCode(65 + idx)}:</span>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Backend Webhook / Service Account Status Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Escritura Automática ({serverStatus?.isWebhook ? 'Webhook Activo' : 'Webhook / Cuenta de Servicio'})
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  serverStatus?.canAccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : serverStatus?.configured
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {serverStatus?.canAccess
                  ? (serverStatus?.isWebhook ? 'Webhook Conectado' : 'Activa y Conectada')
                  : serverStatus?.configured
                  ? 'Permiso de Hoja Pendiente'
                  : 'Sin Webhook ni Credenciales'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Permite que la aplicación escriba directamente en Google Sheets cada vez que una ruta o administrador crea un reclamo, sin necesidad de que los choferes inicien sesión en Google.
            </p>

            {serverStatus?.email && (
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/80 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  {serverStatus.isWebhook ? 'Método de Conexión Activo:' : 'Correo de Cuenta de Servicio:'}
                </span>
                <code className="text-emerald-300 font-mono text-[11px] select-all break-all">
                  {serverStatus.email}
                </code>
              </div>
            )}

            {serverStatus?.error && (
              <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-[11px] text-rose-200">
                ⚠️ {serverStatus.error}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={checkServerSheetsStatus}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Verificar Estado</span>
              </button>

              <button
                type="button"
                onClick={handleSyncAllClaims}
                disabled={isSyncingAll}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Sincronizando...' : 'Sincronizar Reclamos Existentes'}</span>
              </button>
            </div>
          </div>

          {/* Google OAuth Connect Option */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                Conexión Interactiva con Cuenta de Google
              </span>
              {googleUserEmail && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Sesión Iniciada
                </span>
              )}
            </div>

            {googleUserEmail ? (
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Cuenta Activa
                  </span>
                  <span className="text-xs font-bold text-slate-900">{googleUserEmail}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestConnection()}
                    disabled={checkingConnection}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingConnection ? 'animate-spin' : ''}`} />
                    <span>Probar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-600 mb-2">
                  Si prefieres autorizar la hoja directamente con tu cuenta personal o de empresa:
                </p>
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={isSigningIn}
                  className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Conectando con Google...' : 'Iniciar Sesión con Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Setup Guide for Service Account */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              Paso Clave para Conexión Automática (Vercel / Producción):
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-amber-900/90">
              <li>
                Abre tu hoja de cálculo:{' '}
                <a
                  href={`https://docs.google.com/spreadsheets/d/${activeSheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-amber-950 underline"
                >
                  Base de datos real
                </a>
              </li>
              <li>Haz clic en el botón verde superior derecho <strong>Compartir (Share)</strong>.</li>
              <li>
                Agrega el correo de tu cuenta de servicio con rol de <strong>Editor</strong>.
              </li>
              <li>
                En Vercel (o tu hosting), agrega las variables:
                <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono font-bold">GOOGLE_SHEET_ID</code>,
                <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono font-bold">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> y
                <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono font-bold">GOOGLE_PRIVATE_KEY</code>.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={() => handleTestConnection()}
            disabled={checkingConnection}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
            <span>{checkingConnection ? 'Verificando...' : 'Guardar y Verificar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
