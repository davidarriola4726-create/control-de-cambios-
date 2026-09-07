import React from 'react';
import { ProductClaim } from '../types';
import { Printer, X, CheckCircle2, Calendar, FileText, User, Truck, Package, AlertCircle, FileDown, Lock } from 'lucide-react';

interface VoucherModalProps {
  claim: ProductClaim | null;
  isOpen: boolean;
  onClose: () => void;
  onPrint?: () => void;
  logoUrl?: string;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  claim,
  isOpen,
  onClose,
  logoUrl
}) => {
  if (!isOpen || !claim) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fade-in">
        {/* Modal Toolbar (hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight">Comprobante Oficial de Cambio MYG</h2>
              <p className="text-xs text-slate-300">Voucher consecutivo generado automáticamente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="Imprimir o guardar en PDF mediante el diálogo de impresión"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Cerrar vista previa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="print-container p-6 sm:p-8 bg-white text-slate-900">
          {/* Header con Logo Centrado, Proporcional y Claro */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 text-center">
            {/* Logo Centrado (40-50% de ancho, sin marco blanco ni bordes) */}
            <div className="w-full bg-[#272d34] py-3.5 sm:py-4.5 px-4 flex justify-center items-center mb-4 print:bg-[#272d34]">
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
                className="w-[85%] sm:w-[48%] md:w-[45%] max-w-[460px] h-auto object-contain mx-auto block print:max-w-[380px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span className="text-xs font-black tracking-widest text-emerald-800 uppercase">
                  MYG • Control Logístico y Operativo
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
                VOUCHER DE CAMBIO / RECLAMACIÓN
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprobante oficial de retiro y sustitución de producto
              </p>
            </div>

            {/* Consecutivo Box Centrado */}
            <div className="mt-4 inline-flex flex-col sm:flex-row items-center justify-center gap-3 bg-slate-100 border border-slate-300 rounded-xl px-5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                  N° Requerimiento Consecutivo:
                </span>
                <span className="text-lg sm:text-xl font-mono font-black text-emerald-700 tracking-tight">
                  {claim.voucherNumber}
                </span>
              </div>
              <span className="hidden sm:inline text-slate-300">|</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{claim.formattedDate} - {claim.formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Ruta y Estado de Requerimiento */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/80 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md font-mono font-black text-xs bg-slate-900 text-white">
                {claim.routeId || 'RUTA-1'}
              </span>
              <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Estado: <strong className="uppercase">{claim.status}</strong></span>
              </div>
            </div>
            <span className="text-emerald-700 font-semibold text-[11px]">
              {claim.syncedToCloud ? '✓ Sincronizado en Nube' : '✓ Guardado Local'}
            </span>
          </div>

          {/* Datos Generales (2 Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Cliente y Factura */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <User className="w-3.5 h-3.5 text-slate-700" />
                Datos del Cliente y Facturación
              </h3>
              <div className="space-y-1.5 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Nombre del Cliente:</span>
                  <strong className="text-slate-900 font-bold">{claim.clientName}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                  <span className="text-xs text-slate-500">N° de Factura:</span>
                  <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {claim.invoiceNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Personal y Distribución */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <Truck className="w-3.5 h-3.5 text-slate-700" />
                Personal y Distribución
              </h3>
              <div className="space-y-1.5 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Vendedor Asignado:</span>
                  <strong className="text-slate-900 font-bold">{claim.vendorName}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                  <span className="text-xs text-slate-500">Piloto / Quien Entrega:</span>
                  <strong className="text-slate-800 font-semibold">{claim.deliveryPerson}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Detalle del Producto Reclamado */}
          <div className="border border-slate-300 rounded-xl p-4 mb-5 bg-white shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
              <Package className="w-3.5 h-3.5 text-slate-700" />
              Detalle del Producto y Causa de la Reclamación
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-200">
              <div className="sm:col-span-2">
                <span className="text-xs text-slate-500 block">Producto Reclamado:</span>
                <span className="text-base font-black text-slate-900">{claim.productName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Cantidad y Presentación:</span>
                <span className="text-base font-black text-emerald-700">
                  {claim.quantity} <span className="text-xs font-semibold text-slate-600">({claim.unit})</span>
                </span>
              </div>
            </div>

            <div className="pt-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Motivo del Cambio:</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      {claim.reason}
                    </span>
                  </div>
                  {claim.reasonDetails && (
                    <p className="text-xs text-slate-700 mt-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {claim.reasonDetails}
                    </p>
                  )}
                  {claim.notes && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      Observaciones: {claim.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Firmas Digitales ✍️ (Obligatorias del Cliente y Vendedor) */}
          <div className="pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">
              Firmas Digitales de Conformidad en Pantalla
            </h3>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {/* Firma Vendedor */}
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center text-center">
                <div className="w-full h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden mb-2 shadow-2xs">
                  {claim.vendorSignature ? (
                    <img
                      src={claim.vendorSignature}
                      alt="Firma del Vendedor"
                      className="max-h-full max-w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin firma registrada</span>
                  )}
                </div>
                <div className="w-full border-t border-slate-300 pt-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{claim.vendorName}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Firma Vendedor ({claim.routeId || 'Ruta'})
                  </p>
                </div>
              </div>

              {/* Firma Cliente */}
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center text-center">
                <div className="w-full h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden mb-2 shadow-2xs">
                  {claim.clientSignature ? (
                    <img
                      src={claim.clientSignature}
                      alt="Firma del Cliente"
                      className="max-h-full max-w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin firma registrada</span>
                  )}
                </div>
                <div className="w-full border-t border-slate-300 pt-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{claim.clientName}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Firma del Cliente Receptor
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Voucher */}
          <div className="border-t border-slate-200 mt-6 pt-3 flex justify-between items-center text-[10px] text-slate-400">
            <span>MYG Sistema de Control de Cambios y Reclamaciones de Productos</span>
            <span>Documento numerado e irrepetible • {claim.voucherNumber}</span>
          </div>
        </div>

        {/* Modal Bottom Actions (hidden in print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Para guardar en PDF, elija "Guardar como PDF" en el destino de impresión.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
