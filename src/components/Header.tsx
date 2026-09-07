import React, { useState } from 'react';
import { ActiveTab, UserAccount } from '../types';
import {
  FilePlus,
  FolderTree,
  BarChart3,
  Receipt,
  RotateCw,
  Boxes,
  Wifi,
  WifiOff,
  Bell,
  BellRing,
  Users,
  KeyRound,
  LogOut,
  ChevronDown,
  Shield,
  Truck,
  Volume2,
  Image,
  FileSpreadsheet
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCloudSynced: boolean;
  isSyncing: boolean;
  onManualSync: () => void;
  totalClaimsCount: number;
  currentUser: UserAccount | null;
  unreadAlertsCount: number;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  onTestSound?: () => void;
  logoUrl?: string;
  onOpenLogoConfig?: () => void;
  onOpenGoogleSheets?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isCloudSynced,
  isSyncing,
  onManualSync,
  totalClaimsCount,
  currentUser,
  unreadAlertsCount,
  onOpenChangePassword,
  onLogout,
  onTestSound,
  logoUrl,
  onOpenLogoConfig,
  onOpenGoogleSheets
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Encabezado Superior: Logo Centrado (40-50% ancho), Sin marco blanco ni bordes, integrado al fondo */}
      <div className="w-full bg-[#272d34] flex items-center justify-center py-3.5 sm:py-4.5 px-4 overflow-hidden border-b border-[#1b1e22]">
        <div className="w-full max-w-7xl mx-auto flex justify-center items-center">
          <img
            src={logoUrl || 'https://drive.google.com/uc?export=view&id=1CXYEzIMay6FRiYLLww9hjbc9xeMk82xi'}
            alt="Logo MYG"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('lh3.googleusercontent.com')) {
                target.src = 'https://lh3.googleusercontent.com/d/1CXYEzIMay6FRiYLLww9hjbc9xeMk82xi';
              }
            }}
            className="w-[85%] sm:w-[48%] md:w-[45%] max-w-[580px] h-auto object-contain mx-auto block drop-shadow-md select-none"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Nombre del Sistema */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black tracking-widest text-emerald-800 uppercase">
                MYG • Control Logístico
              </span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="hidden sm:inline-block text-[11px] text-slate-500 font-medium">
                {totalClaimsCount} {totalClaimsCount === 1 ? 'voucher' : 'vouchers'}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
              Control de Cambios y Reclamaciones
            </h1>
          </div>

          {/* Right Section: Alerts + Cloud Sync + User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin Alert Button & Sound Test */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onTabChange('admin-alerts')}
                  className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                    unreadAlertsCount > 0
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20 animate-pulse'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Panel de Alertas Recientes"
                >
                  {unreadAlertsCount > 0 ? (
                    <BellRing className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {unreadAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-white">
                      {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Cloud Sync Status */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border text-xs font-medium transition-colors ${
                isCloudSynced
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title={
                isCloudSynced
                  ? 'Sincronizado en la nube en tiempo real y respaldado localmente'
                  : 'Modo local activo. Pendiente de sincronizar'
              }
            >
              {isCloudSynced ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
                  <span className="text-[11px] sm:text-xs font-semibold">
                    En Tiempo Real
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] sm:text-xs font-semibold">
                    Respaldo Local
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onManualSync}
              disabled={isSyncing}
              className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Sincronizar ahora"
            >
              <RotateCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {onOpenGoogleSheets && (
              <button
                type="button"
                onClick={onOpenGoogleSheets}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Conectar o configurar Base de Datos en Google Sheets (USUARIOS y RECLAMOS)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Google Sheets</span>
              </button>
            )}

            {/* User Profile Badge / Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isAdmin
                      ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                      : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <span className="shrink-0">
                    {isAdmin ? (
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </span>
                  <div className="text-left">
                    <span className="block text-[10px] text-slate-500 uppercase leading-none">
                      {currentUser.role === 'ADMIN' ? 'Admin' : currentUser.routeId}
                    </span>
                    <span className="truncate max-w-[110px] sm:max-w-[140px] block leading-tight">
                      {currentUser.vendorName || currentUser.username}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Sesión Activa
                      </span>
                      <strong className="text-xs text-slate-900 block truncate">
                        {currentUser.displayName || currentUser.username}
                      </strong>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        {currentUser.vendorName}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserMenu(false);
                        onOpenChangePassword();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>Cambiar Contraseña</span>
                    </button>

                    {onOpenLogoConfig && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserMenu(false);
                          onOpenLogoConfig();
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Image className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Configurar / Cambiar Logo</span>
                      </button>
                    )}

                    {isAdmin && onTestSound && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTestSound();
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Probar Sonido de Alerta</span>
                      </button>
                    )}

                    {onOpenGoogleSheets && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserMenu(false);
                          onOpenGoogleSheets();
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-medium text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Base de Datos Google Sheets</span>
                      </button>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar Sesión / Cambiar Cuenta</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Barra de Pestañas / Menú Interactivo Adaptado al Rol */}
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none border-t border-slate-100 sm:border-t-0">
          <button
            type="button"
            onClick={() => onTabChange('new-claim')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'new-claim'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FilePlus className="w-4 h-4" />
            <span>+ Nuevo Reclamo</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('vendor-folders')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vendor-folders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>
              {isAdmin ? 'Carpetas por Ruta' : `Mi Carpeta (${currentUser?.routeId || 'Ruta'})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('statistics')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'statistics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isAdmin ? 'Gráficas Generales' : 'Mis Gráficas'}</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('voucher-history')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'voucher-history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{isAdmin ? 'Historial Global' : 'Mis Vouchers'}</span>
          </button>

          {/* Admin Specific Tabs */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => onTabChange('admin-alerts')}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin-alerts'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BellRing className="w-4 h-4" />
                <span>Alertas Recientes</span>
                {unreadAlertsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onTabChange('admin-users')}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin-users'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Gestión de Rutas</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
