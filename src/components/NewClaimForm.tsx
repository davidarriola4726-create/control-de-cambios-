import React, { useState, useEffect } from 'react';
import { ProductClaim, ClaimReason, ClaimStatus, UserAccount } from '../types';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { playNewClaimChime } from '../utils/audioAlert';
import {
  REASON_OPTIONS,
  COMMON_PILOTS,
} from '../data/initialData';
import { DEFAULT_USERS, ALL_ROUTES } from '../data/usersData';
import {
  FileText,
  User,
  Truck,
  Package,
  AlertTriangle,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  FolderOpen,
  Lock,
  Calendar,
  ShieldAlert,
  Printer,
  Trash2,
  LogOut
} from 'lucide-react';

interface NewClaimFormProps {
  currentUser: UserAccount;
  onSaveClaim: (claim: Omit<ProductClaim, 'id' | 'voucherNumber' | 'syncedToCloud'>) => Promise<ProductClaim | null>;
  onClaimCreated: (claim: ProductClaim) => void;
  onGoToFolders: () => void;
  onPrintVoucher?: (claim: ProductClaim) => void;
}

export const NewClaimForm: React.FC<NewClaimFormProps> = ({
  currentUser,
  onSaveClaim,
  onClaimCreated,
  onGoToFolders,
  onPrintVoucher
}) => {
  // Live auto-clock for date & time
  const [currentDateTime, setCurrentDateTime] = useState({
    dateStr: '',
    timeStr: '',
    isoStr: ''
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const day = pad(now.getDate());
      const month = pad(now.getMonth() + 1);
      const year = now.getFullYear();
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());

      setCurrentDateTime({
        dateStr: `${day}/${month}/${year}`,
        timeStr: `${hours}:${minutes}`,
        isoStr: now.toISOString()
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isRouteUser = currentUser.role === 'ROUTE';

  // Route and Vendor assignment
  const [selectedRoute, setSelectedRoute] = useState<string>(
    isRouteUser ? (currentUser.routeId || 'RUTA-1') : 'RUTA-1'
  );

  // Vendor name tied to route
  const getVendorForRoute = (route: string) => {
    const found = DEFAULT_USERS.find((u) => u.routeId === route);
    return found ? found.vendorName : `${route} - Vendedor Oficial`;
  };

  const [vendorName, setVendorName] = useState<string>(() => {
    if (isRouteUser) return currentUser.vendorName;
    return getVendorForRoute('RUTA-1');
  });

  // When admin switches route selector, update vendor automatically
  const handleAdminRouteChange = (newRoute: string) => {
    setSelectedRoute(newRoute);
    setVendorName(getVendorForRoute(newRoute));
  };

  // Form inputs
  const [clientName, setClientName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('Unidades');
  const [reason, setReason] = useState<ClaimReason>(REASON_OPTIONS[0]);
  const [reasonDetails, setReasonDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('Cambio Realizado');

  // Signatures
  const [vendorSignature, setVendorSignature] = useState('');
  const [clientSignature, setClientSignature] = useState('');

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastSavedClaim, setLastSavedClaim] = useState<ProductClaim | null>(null);

  const effectiveProduct = productName.trim();
  const effectiveDelivery = deliveryPerson.trim();
  const effectiveRoute = isRouteUser ? (currentUser.routeId || 'RUTA-1') : selectedRoute;
  const effectiveVendor = isRouteUser ? currentUser.vendorName : vendorName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 8 CAMPOS OBLIGATORIOS ESTRICTOS
    if (!clientName.trim()) {
      setErrorMessage('Campo obligatorio: Ingrese el Nombre del Cliente.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!invoiceNumber.trim()) {
      setErrorMessage('Campo obligatorio: Ingrese el Número de Factura.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!effectiveDelivery) {
      setErrorMessage('Campo obligatorio: Ingrese el Nombre del Piloto encargado.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!effectiveProduct) {
      setErrorMessage('Campo obligatorio: Escriba el nombre exacto del producto.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!reason) {
      setErrorMessage('Campo obligatorio: Seleccione el Motivo del cambio o reclamación.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!vendorSignature || vendorSignature.length < 50) {
      setErrorMessage('Firma digital obligatoria: El VENDEDOR debe estampar su firma digital.');
      return;
    }
    if (!clientSignature || clientSignature.length < 50) {
      setErrorMessage('Firma digital obligatoria: El CLIENTE debe estampar su firma digital.');
      return;
    }

    setSubmitting(true);
    try {
      const claimPayload: Omit<ProductClaim, 'id' | 'voucherNumber' | 'syncedToCloud'> = {
        createdAt: currentDateTime.isoStr || new Date().toISOString(),
        formattedDate: currentDateTime.dateStr,
        formattedTime: currentDateTime.timeStr,
        routeId: effectiveRoute,
        vendorName: effectiveVendor,
        clientName: clientName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        deliveryPerson: effectiveDelivery,
        productName: effectiveProduct,
        quantity: Number(quantity) || 1,
        unit: unit.trim() || 'Unidades',
        reason,
        reasonDetails: reasonDetails.trim(),
        notes: notes.trim(),
        status,
        vendorSignature,
        clientSignature,
      };

      const created = await onSaveClaim(claimPayload);

      const voucherCode = created?.voucherNumber || 'MYG-REC-0001';
      setSuccessMessage(`✅ Guardado y sincronizado en tiempo real — N°: ${voucherCode}`);
      playNewClaimChime(0.8);
      
      // Clear signatures and form
      setClientName('');
      setInvoiceNumber('');
      setDeliveryPerson('');
      setProductName('');
      setReasonDetails('');
      setNotes('');
      setVendorSignature('');
      setClientSignature('');

      if (created) {
        setLastSavedClaim(created);
        onClaimCreated(created);
      }
    } catch (err: any) {
      setErrorMessage('Error al guardar el reclamo: ' + (err.message || 'Intente nuevamente'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (window.confirm('¿Desea limpiar los campos del formulario?')) {
      setClientName('');
      setInvoiceNumber('');
      setDeliveryPerson('');
      setProductName('');
      setReasonDetails('');
      setNotes('');
      setQuantity(1);
      setVendorSignature('');
      setClientSignature('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 animate-fade-in pb-6">
      {/* Banner Superior con Identidad MYG y Asignación de Ruta */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl p-3.5 sm:p-4 shadow-md border border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                MYG • Registro Oficial
              </span>
              <span className="text-[11px] text-slate-300 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                {currentDateTime.dateStr} - {currentDateTime.timeStr}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
              Nuevo Reclamo y Cambio de Producto
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Complete los datos obligatorios y capture las firmas digitales para generar el voucher.
            </p>
          </div>

          {/* Badge de Ruta Asignada */}
          <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl px-3 py-2 text-right shrink-0">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              Ruta Operativa Asignada
            </span>
            <div className="flex items-center justify-end gap-1 text-emerald-400 font-black text-sm font-mono">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{effectiveRoute}</span>
            </div>
            <span className="text-[10px] text-slate-300 block truncate max-w-[180px]">
              {effectiveVendor}
            </span>
          </div>
        </div>
      </div>

      {/* Alertas de Error y Éxito */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Atención:</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-start justify-between gap-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <strong className="block font-bold">¡Registro Completado!</strong>
              <span>{successMessage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToFolders}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-xs"
          >
            Ver Carpeta
          </button>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Sección 1: Ruta y Vendedor (Asignación Automática No Modificable para Rutas) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                1. Asignación de Ruta y Vendedor Responsable
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-slate-400" />
              {isRouteUser ? 'Automático por sesión' : 'Selector de Admin'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ruta */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Número de Ruta *
              </label>
              {isRouteUser ? (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold text-slate-800">
                  <span className="font-mono text-emerald-800 font-black">{effectiveRoute}</span>
                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Fijo
                  </span>
                </div>
              ) : (
                <select
                  value={selectedRoute}
                  onChange={(e) => handleAdminRouteChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  {ALL_ROUTES.map((route) => (
                    <option key={route} value={route}>
                      {route} — {getVendorForRoute(route)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Vendedor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre del Vendedor *
              </label>
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800">
                <span>{effectiveVendor}</span>
                <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Fijo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2: Datos de Cliente, Factura y Piloto */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              2. Datos del Cliente, Factura y Piloto
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Nombre del Cliente */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre del Cliente <span className="text-rose-600 font-black">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej. Supermercado La Esperanza"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Número de Factura */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Número de Factura <span className="text-rose-600 font-black">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej. FAC-10294"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-mono font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Nombre del Piloto */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nombre del Piloto <span className="text-rose-600 font-black">*</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  Editable
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Truck className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  list="pilots-datalist"
                  value={deliveryPerson}
                  onChange={(e) => setDeliveryPerson(e.target.value)}
                  placeholder="Escriba o seleccione piloto..."
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
                <datalist id="pilots-datalist">
                  {COMMON_PILOTS.map((pilot) => (
                    <option key={pilot} value={pilot} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 3: Detalle del Producto y Motivo */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              3. Detalle del Producto y Causa de la Reclamación
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Nombre del Producto: Campo libre obligatorio, sin lista ni autocompletado */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nombre del Producto <span className="text-rose-600 font-black">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Texto libre obligatorio
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Package className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Escriba el nombre exacto del producto"
                  required
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Cantidad y Unidad */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cantidad y Presentación *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                  className="w-20 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Unidades">Unidades</option>
                  <option value="Cajas">Cajas</option>
                  <option value="Paquetes">Paquetes</option>
                  <option value="Botellas">Botellas</option>
                  <option value="Envases">Envases</option>
                </select>
              </div>
            </div>

            {/* Motivo de Reclamación */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Motivo del Cambio o Reclamación <span className="text-rose-600 font-black">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ClaimReason)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado de Requerimiento */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estado de la Gestión
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClaimStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cambio Realizado">Cambio Realizado (In Situ)</option>
                <option value="Aprobado">Aprobado (Para Próxima Entrega)</option>
                <option value="En Revisión">En Revisión / Análisis de Calidad</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            </div>

            {/* Detalle o Descripción del problema */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Descripción detallada de la anomalía o reclamo
              </label>
              <textarea
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Indique con claridad el defecto encontrado, rotura, sello violado o inconsistencia observada..."
                rows={2}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Sección 4: Firmas Digitales en Pantalla (Obligatorias) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                4. Firmas Digitales en Pantalla (Vendedor y Cliente)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Ambas Firmas Obligatorias *
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mb-3">
            Dibuje la firma directamente en pantalla utilizando el dedo (celular o tableta) o ratón/mouse.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Firma del Vendedor */}
            <div>
              <DigitalSignaturePad
                label="Firma Digital del Vendedor / Asesor"
                signeeName={effectiveVendor}
                signeeRole="Vendedor"
                value={vendorSignature}
                onChange={(dataUrl) => setVendorSignature(dataUrl)}
              />
            </div>

            {/* Firma del Cliente */}
            <div>
              <DigitalSignaturePad
                label="Firma Digital del Cliente Receptor"
                signeeName={clientName || 'Cliente / Encargado'}
                signeeRole="Cliente"
                value={clientSignature}
                onChange={(dataUrl) => setClientSignature(dataUrl)}
              />
            </div>
          </div>
        </div>

        {/* Barra de Acciones Compacta: Guardar Reclamo → Imprimir → Eliminar → Salir */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Botón 1: Guardar Reclamo */}
            <button
              type="submit"
              disabled={submitting}
              id="btn-guardar-reclamo"
              className="flex-1 min-w-[150px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting ? 'Guardando...' : 'Guardar Reclamo'}
              </span>
            </button>

            {/* Botón 2: Imprimir */}
            <button
              type="button"
              id="btn-imprimir-voucher"
              onClick={() => {
                if (lastSavedClaim) {
                  if (onPrintVoucher) {
                    onPrintVoucher(lastSavedClaim);
                  } else {
                    window.print();
                  }
                } else {
                  alert('Primero debe guardar el reclamo para poder imprimir el voucher consecutivo oficial.');
                }
              }}
              className="flex-1 min-w-[110px] px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Imprimir</span>
            </button>

            {/* Botón 3: Eliminar */}
            <button
              type="button"
              id="btn-eliminar-formulario"
              onClick={handleResetForm}
              className="flex-1 min-w-[110px] px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Limpiar</span>
            </button>

            {/* Botón 4: Salir */}
            <button
              type="button"
              id="btn-salir-formulario"
              onClick={onGoToFolders}
              className="flex-1 min-w-[100px] px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
