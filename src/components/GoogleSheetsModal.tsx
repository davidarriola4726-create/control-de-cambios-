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
  LogIn
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
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<SheetConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isInitializingSheets, setIsInitializingSheets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredSpreadsheetId();
      setSpreadsheetInput(stored);
      const user = getCachedGoogleUser();
      if (user?.email) {
        setGoogleUserEmail(user.email);
      }
      if (stored) {
        handleTestConnection(stored);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleConnect = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const authResult = await googleSignIn();
      if (authResult?.user?.email) {
        setGoogleUserEmail(authResult.user.email);
        setSuccessMessage('Sesión iniciada con Google exitosamente.');
        const targetId = extractSpreadsheetId(spreadsheetInput) || getStoredSpreadsheetId();
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
    const cleanId = extractSpreadsheetId(raw);
    if (!cleanId) {
      setError('Por favor ingrese el ID o enlace completo de la hoja de Google Sheets.');
      return;
    }

    setCheckingConnection(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = tokenOverride || (await getAccessToken());
      if (!token) {
        setError('Primero debe conectar su cuenta de Google haciendo clic en el botón oficial abajo.');
        setCheckingConnection(false);
        return;
      }

      const info = await inspectSpreadsheet(token, cleanId);
      setConnectionInfo(info);
      saveSpreadsheetId(cleanId);
      setSuccessMessage(`¡Conexión exitosa con la hoja "${info.spreadsheetTitle}"!`);
      onConnectionUpdated();
    } catch (err: any) {
      console.error('Error inspecting spreadsheet:', err);
      setError('Error al verificar la hoja: ' + (err.message || 'Verifique los permisos y el ID.'));
      setConnectionInfo(null);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleCreateMissingStructure = async () => {
    const cleanId = extractSpreadsheetId(spreadsheetInput) || getStoredSpreadsheetId();
    if (!cleanId) return;

    setIsInitializingSheets(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Se requiere autenticación de Google.');

      const needUsuarios = !connectionInfo?.hasUsuariosSheet;
      const needReclamos = !connectionInfo?.hasReclamosSheet;

      await initializeSheetStructure(token, cleanId, needUsuarios, needReclamos);
      setSuccessMessage('¡Estructura de hojas inicializada correctamente en Google Sheets!');
      await handleTestConnection(cleanId, token);
      onConnectionUpdated();
    } catch (err: any) {
      setError('Error al crear las hojas: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsInitializingSheets(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                  Base de Datos Oficial
                </span>
                <h2 className="text-xl font-black tracking-tight">
                  Conexión con Google Sheets
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            Conecte directamente su archivo de Google Sheets. El sistema leerá y sincronizará únicamente las hojas <strong className="text-emerald-300">USUARIOS</strong> y <strong className="text-emerald-300">RECLAMOS</strong>.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Atención:</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Step 1: Google Account Authentication */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Autorización de Google Workspace
              </span>
              {googleUserEmail ? (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">
                  Pendiente de conexión
                </span>
              )}
            </div>

            {googleUserEmail ? (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block">Cuenta autorizada:</span>
                  <span className="text-xs font-bold text-slate-900">{googleUserEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutGoogle();
                    setGoogleUserEmail(null);
                    setConnectionInfo(null);
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                >
                  Cambiar Cuenta
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-slate-600 mb-3">
                  Inicie sesión con su cuenta de Google con permisos sobre su hoja de cálculo:
                </p>
                {/* Official Google Sign-in Styled Button */}
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-all cursor-pointer font-bold text-xs sm:text-sm text-slate-700 hover:text-slate-900"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {isSigningIn ? 'Conectando con Google...' : 'Conectar con Google Workspace'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Spreadsheet URL or ID */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Enlace o ID de la Hoja de Cálculo
              </label>
              <span className="text-[10px] text-emerald-700 font-semibold">
                Google Sheets
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0.../edit o el ID"
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleTestConnection()}
                disabled={checkingConnection}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
                <span>{checkingConnection ? 'Verificando...' : 'Verificar'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Pegue la URL completa desde la barra del navegador o únicamente el identificador alfanumérico.
            </p>
          </div>

          {/* Step 3: Status of Required Sheets */}
          {connectionInfo && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Documento Detectado
                  </span>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>{connectionInfo.spreadsheetTitle}</span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${extractSpreadsheetId(spreadsheetInput)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 p-0.5"
                      title="Abrir en Google Sheets"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  En Línea
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tab USUARIOS */}
                <div
                  className={`p-3 rounded-xl border ${
                    connectionInfo.hasUsuariosSheet
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      USUARIOS
                    </span>
                    {connectionInfo.hasUsuariosSheet ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <span className="text-[11px] block">
                    {connectionInfo.hasUsuariosSheet
                      ? 'Hoja activa para validación de acceso.'
                      : 'Falta la pestaña "USUARIOS".'}
                  </span>
                </div>

                {/* Tab RECLAMOS */}
                <div
                  className={`p-3 rounded-xl border ${
                    connectionInfo.hasReclamosSheet
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black flex items-center gap-1">
                      <Database className="w-3.5 h-3.5" />
                      RECLAMOS
                    </span>
                    {connectionInfo.hasReclamosSheet ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <span className="text-[11px] block">
                    {connectionInfo.hasReclamosSheet
                      ? 'Hoja activa para registros y eliminación.'
                      : 'Falta la pestaña "RECLAMOS".'}
                  </span>
                </div>
              </div>

              {(!connectionInfo.hasUsuariosSheet || !connectionInfo.hasReclamosSheet) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCreateMissingStructure}
                    disabled={isInitializingSheets}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Layers className="w-4 h-4" />
                    <span>
                      {isInitializingSheets
                        ? 'Creando pestañas requeridas...'
                        : 'Crear pestañas USUARIOS y RECLAMOS automáticamente'}
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1 text-center">
                    Creará las columnas oficiales requeridas y registrará a los usuarios autorizados (Admin y Rutas 1 a 11).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Los cambios se guardan y reflejan en tiempo real.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
