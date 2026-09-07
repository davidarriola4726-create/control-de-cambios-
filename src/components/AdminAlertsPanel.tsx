import React, { useState, useMemo } from 'react';
import { AdminAlert, ProductClaim } from '../types';
import { playNewClaimChime } from '../utils/audioAlert';
import {
  Bell,
  BellRing,
  Volume2,
  CheckCheck,
  Search,
  ExternalLink,
  Trash2,
  Calendar,
  User,
  Package,
  Truck,
  FileCheck,
  AlertTriangle
} from 'lucide-react';

interface AdminAlertsPanelProps {
  alerts: AdminAlert[];
  claims: ProductClaim[];
  onOpenVoucher: (claim: ProductClaim) => void;
  onMarkRead: (alertId: string) => void;
  onMarkAllRead: () => void;
  onDeleteAlert?: (alertId: string) => void;
}

export const AdminAlertsPanel: React.FC<AdminAlertsPanelProps> = ({
  alerts,
  claims,
  onOpenVoucher,
  onMarkRead,
  onMarkAllRead,
  onDeleteAlert
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [testedSound, setTestedSound] = useState(false);

  const handleTestSound = () => {
    playNewClaimChime(0.9);
    setTestedSound(true);
    setTimeout(() => setTestedSound(false), 2000);
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filterUnreadOnly && alert.read) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoute = alert.routeId.toLowerCase().includes(q);
        const matchesProduct = alert.productName.toLowerCase().includes(q);
        const matchesClient = alert.clientName.toLowerCase().includes(q);
        const matchesMsg = alert.message.toLowerCase().includes(q);
        const matchesVoucher = alert.voucherNumber?.toLowerCase().includes(q);
        return matchesRoute || matchesProduct || matchesClient || matchesMsg || matchesVoucher;
      }

      return true;
    });
  }, [alerts, filterUnreadOnly, searchQuery]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleOpenClaimFromAlert = (alert: AdminAlert) => {
    onMarkRead(alert.id);
    const matchedClaim = claims.find((c) => c.id === alert.claimId || c.voucherNumber === alert.voucherNumber);
    if (matchedClaim) {
      onOpenVoucher(matchedClaim);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner with Summary and Sound Controls */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-300/60 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-amber-500 text-slate-950 rounded-xl shadow-md shrink-0">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                  Monitoreo en Tiempo Real
                </span>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                    {unreadCount} sin leer
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Panel de Alertas Recientes al Administrador
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Notificaciones automáticas con sonido en vivo cada vez que cualquier ruta registra un nuevo reclamo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestSound}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                testedSound
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              <Volume2 className={`w-4 h-4 ${testedSound ? 'animate-spin' : 'text-amber-600'}`} />
              <span>{testedSound ? '¡Sonando!' : 'Probar Sonido de Alerta 🔊'}</span>
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Marcar Todas como Vistas</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar alerta por ruta, producto, cliente..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
              filterUnreadOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {filterUnreadOnly ? 'Solo No Vistas' : 'Todas las Alertas'}
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {filteredAlerts.length} {filteredAlerts.length === 1 ? 'alerta' : 'alertas'}
          </span>
        </div>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No hay alertas recientes</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Cuando cualquier ruta ingrese un reclamo de producto, aquí se registrará la notificación instantánea con sonido.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const matchedClaim = claims.find(
              (c) => c.id === alert.claimId || c.voucherNumber === alert.voucherNumber
            );

            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !alert.read
                    ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      !alert.read
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-slate-900 text-white tracking-wide">
                        {alert.routeId}
                      </span>
                      {alert.voucherNumber && (
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                          {alert.voucherNumber}
                        </span>
                      )}
                      {!alert.read && (
                        <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Nueva Alerta
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {alert.formattedDateTime}
                      </span>
                    </div>

                    {/* Notification text as specified */}
                    <p className="text-sm font-bold text-slate-900 tracking-tight">
                      {alert.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        Producto: <strong className="text-slate-800">{alert.productName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Cliente: <strong className="text-slate-800">{alert.clientName}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {matchedClaim && (
                    <button
                      type="button"
                      onClick={() => handleOpenClaimFromAlert(alert)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Ver Voucher</span>
                    </button>
                  )}

                  {!alert.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(alert.id)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="Marcar como vista"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}

                  {onDeleteAlert && (
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alert.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar notificación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
