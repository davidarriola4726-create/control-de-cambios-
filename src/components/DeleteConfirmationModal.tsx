import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  claimId: string;
  voucherNumber?: string;
  clientName?: string;
  productName?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  claimId,
  voucherNumber,
  clientName,
  productName,
  isDeleting = false,
  errorMessage = null
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-black tracking-widest uppercase text-rose-700 block">
              Confirmación de Eliminación
            </span>
            <h3 className="text-base font-black text-slate-900 leading-snug">
              ⚠️ ¿Seguro que desea eliminar este reclamo del historial?
            </h3>
            <p className="text-xs font-bold text-rose-700 mt-1">
              Esta acción no se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Se buscará el reclamo en la hoja <strong className="text-slate-900 font-bold">RECLAMOS</strong> de Google Sheets y se <strong className="text-rose-700 font-bold">eliminará la fila completa</strong> de forma física e irreversible.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>N° Reclamo / Voucher:</span>
              <span className="font-mono font-bold text-slate-900">
                {voucherNumber || claimId}
              </span>
            </div>
            {clientName && (
              <div className="flex justify-between text-slate-500">
                <span>Cliente:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">
                  {clientName}
                </span>
              </div>
            )}
            {productName && (
              <div className="flex justify-between text-slate-500">
                <span>Producto:</span>
                <span className="font-medium text-slate-700 truncate max-w-[200px]">
                  {productName}
                </span>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-900">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Action Buttons: SÍ / NO */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            NO, Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Borrando fila en Sheets...' : 'SÍ, Eliminar Definitivamente'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
