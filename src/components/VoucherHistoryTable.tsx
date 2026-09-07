import React, { useState, useMemo } from 'react';
import { ProductClaim, UserAccount } from '../types';
import { REASON_OPTIONS } from '../data/initialData';
import { ALL_ROUTES } from '../data/usersData';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import {
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  FileText,
  Clock,
  User,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Calendar,
  Trash2
} from 'lucide-react';

interface VoucherHistoryTableProps {
  claims: ProductClaim[];
  currentUser: UserAccount;
  onOpenVoucher: (claim: ProductClaim) => void;
  onNewClaim: () => void;
  onDeleteClaim?: (claimId: string) => void;
}

export const VoucherHistoryTable: React.FC<VoucherHistoryTableProps> = ({
  claims,
  currentUser,
  onOpenVoucher,
  onNewClaim,
  onDeleteClaim,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Base claims by user role
  const baseClaims = useMemo(() => {
    if (!isAdmin) {
      return claims.filter((c) => c.routeId === currentUser.routeId);
    }
    return claims;
  }, [claims, isAdmin, currentUser.routeId]);

  const [search, setSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedReason, setSelectedReason] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Delete modal state
  const [claimToDelete, setClaimToDelete] = useState<ProductClaim | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!claimToDelete || !onDeleteClaim) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteClaim(claimToDelete.id);
      setClaimToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'No se pudo eliminar. Verifica los permisos de la base de datos.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract products
  const products = useMemo(() => {
    const list = Array.from(new Set(baseClaims.map((c) => c.productName))).filter(Boolean).sort();
    return list;
  }, [baseClaims]);

  // Filtered dataset
  const filteredClaims = useMemo(() => {
    return baseClaims.filter((claim) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          claim.voucherNumber.toLowerCase().includes(q) ||
          claim.clientName.toLowerCase().includes(q) ||
          claim.invoiceNumber.toLowerCase().includes(q) ||
          claim.productName.toLowerCase().includes(q) ||
          claim.deliveryPerson.toLowerCase().includes(q) ||
          claim.vendorName.toLowerCase().includes(q) ||
          (claim.routeId && claim.routeId.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (isAdmin && selectedRoute !== 'ALL' && claim.routeId !== selectedRoute) return false;
      if (selectedProduct !== 'ALL' && claim.productName !== selectedProduct) return false;
      if (selectedReason !== 'ALL' && claim.reason !== selectedReason) return false;
      if (selectedStatus !== 'ALL' && claim.status !== selectedStatus) return false;

      if (startDate) {
        const claimDate = new Date(claim.createdAt).toISOString().split('T')[0];
        if (claimDate < startDate) return false;
      }
      if (endDate) {
        const claimDate = new Date(claim.createdAt).toISOString().split('T')[0];
        if (claimDate > endDate) return false;
      }

      return true;
    });
  }, [baseClaims, search, isAdmin, selectedRoute, selectedProduct, selectedReason, selectedStatus, startDate, endDate]);

  const handleExportCSV = () => {
    const headers = [
      'Ruta',
      'Voucher',
      'Fecha',
      'Hora',
      'Cliente',
      'Factura',
      'Vendedor',
      'Piloto',
      'Producto',
      'Cantidad',
      'Unidad',
      'Motivo',
      'Estado',
      'Observaciones'
    ];

    const rows = filteredClaims.map((c) => [
      `"${c.routeId || ''}"`,
      c.voucherNumber,
      c.formattedDate,
      c.formattedTime,
      `"${c.clientName.replace(/"/g, '""')}"`,
      c.invoiceNumber,
      `"${c.vendorName.replace(/"/g, '""')}"`,
      `"${c.deliveryPerson.replace(/"/g, '""')}"`,
      `"${c.productName.replace(/"/g, '""')}"`,
      c.quantity,
      c.unit,
      `"${c.reason}"`,
      c.status,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Vouchers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold mb-1">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            {isAdmin ? 'Control General de Vouchers' : `Vouchers Emitidos: ${currentUser.routeId}`}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Historial Global de Vouchers Emitidos' : `Mis Vouchers (${currentUser.vendorName})`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registro consecutivo con búsqueda rápida y reimpresión de comprobantes en PDF.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Informe</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Combinados */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros y Búsqueda Rápida</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredClaims.length} comprobantes encontrados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Búsqueda de texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, factura, voucher..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Ruta (solo visible para admin) */}
          {isAdmin ? (
            <div>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="ALL">Todas las Rutas (1-11)</option>
                {ALL_ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700">
              <Lock className="w-3.5 h-3.5 text-slate-400 mr-2" />
              <span>Ruta Asignada: {currentUser.routeId}</span>
            </div>
          )}

          {/* Producto */}
          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los Productos ({products.length})</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Motivo */}
          <div>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los Motivos</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="Cambio Realizado">Cambio Realizado</option>
              <option value="Aprobado">Aprobado</option>
              <option value="En Revisión">En Revisión</option>
              <option value="Rechazado">Rechazado</option>
            </select>
          </div>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[11px] focus:ring-2 focus:ring-emerald-500"
              title="Fecha Inicial"
            />
            <span className="text-slate-400 text-xs">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[11px] focus:ring-2 focus:ring-emerald-500"
              title="Fecha Final"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Vouchers */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredClaims.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No hay vouchers registrados con estos criterios</h4>
            <button
              onClick={onNewClaim}
              className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Registrar Primer Reclamo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ruta</th>
                  <th className="py-3 px-4">N° Voucher</th>
                  <th className="py-3 px-4">Fecha/Hora</th>
                  <th className="py-3 px-4">Cliente y Factura</th>
                  <th className="py-3 px-4">Producto Reclamado</th>
                  <th className="py-3 px-4 text-center">Cant.</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4">Piloto</th>
                  <th className="py-3 px-4 text-right no-print">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-slate-900 text-white">
                        {claim.routeId || 'RUTA-1'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                      {claim.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {claim.formattedDate} <br />
                      <span className="text-[10px] text-slate-400">{claim.formattedTime}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="block text-slate-900">{claim.clientName}</strong>
                      <span className="font-mono text-[11px] text-slate-500">FAC: {claim.invoiceNumber}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{claim.productName}</span>
                      <span className="text-[11px] text-slate-400 block">{claim.vendorName}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="font-black text-slate-900">{claim.quantity}</span>{' '}
                      <span className="text-[10px] text-slate-500">{claim.unit}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        {claim.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {claim.deliveryPerson}
                    </td>
                    <td className="py-3.5 px-4 text-right no-print">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenVoucher(claim)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                        >
                          Ver Voucher
                        </button>
                        {(isAdmin || claim.routeId === currentUser.routeId) && onDeleteClaim && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setClaimToDelete(claim);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg border border-rose-200 hover:border-rose-600 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                            title="Eliminar permanentemente este reclamo del sistema"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación Oficial */}
      {claimToDelete && (
        <DeleteConfirmationModal
          isOpen={!!claimToDelete}
          onClose={() => {
            if (!isDeleting) {
              setClaimToDelete(null);
              setDeleteError(null);
            }
          }}
          onConfirm={handleConfirmDelete}
          claimId={claimToDelete.id}
          voucherNumber={claimToDelete.voucherNumber}
          clientName={claimToDelete.clientName}
          productName={claimToDelete.productName}
          isDeleting={isDeleting}
          errorMessage={deleteError}
        />
      )}
    </div>
  );
};
