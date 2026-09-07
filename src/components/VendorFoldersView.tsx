import React, { useState, useMemo, useEffect } from 'react';
import { ProductClaim, ClaimReason, UserAccount } from '../types';
import { REASON_OPTIONS } from '../data/initialData';
import { DEFAULT_USERS, ALL_ROUTES } from '../data/usersData';
import {
  Folder,
  FolderOpen,
  Search,
  Calendar,
  Filter,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Package,
  User,
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  Lock,
  Truck,
  Shield,
  Trash2
} from 'lucide-react';

interface VendorFoldersViewProps {
  claims: ProductClaim[];
  currentUser: UserAccount;
  onOpenVoucher: (claim: ProductClaim) => void;
  onDeleteClaim?: (claimId: string) => void;
  onEmptyFolder?: (routeId: string) => void;
  onClearRouteClaims?: (routeId: string) => void;
  onNewClaimForVendor?: (vendorName: string) => void;
}

export const VendorFoldersView: React.FC<VendorFoldersViewProps> = ({
  claims,
  currentUser,
  onOpenVoucher,
  onDeleteClaim,
  onEmptyFolder,
  onClearRouteClaims,
}) => {
  const isRouteUser = currentUser.role === 'ROUTE';
  const userRouteId = currentUser.routeId || 'RUTA-1';
  const clearFolderAction = onClearRouteClaims || onEmptyFolder;

  // Group all claims by routeId (fallback to matching by vendorName or RUTA-1)
  const routeGroups = useMemo(() => {
    const groups: { [key: string]: ProductClaim[] } = {};

    // Initialize all known routes so they always appear as folders even if 0 claims
    ALL_ROUTES.forEach((r) => {
      groups[r] = [];
    });

    claims.forEach((claim) => {
      let r = claim.routeId;
      if (!r) {
        // Infer from vendorName if routeId missing
        const matched = DEFAULT_USERS.find((u) => u.vendorName === claim.vendorName);
        r = matched?.routeId || 'RUTA-1';
      }
      if (!groups[r]) groups[r] = [];
      groups[r].push(claim);
    });

    return groups;
  }, [claims]);

  // Selected route: for route user, strictly their route; for admin, can be null (folder grid) or a route string
  const [selectedRoute, setSelectedRoute] = useState<string | null>(() => {
    if (isRouteUser) return userRouteId;
    return null;
  });

  // Keep route user locked to their route
  useEffect(() => {
    if (isRouteUser) {
      setSelectedRoute(userRouteId);
    }
  }, [isRouteUser, userRouteId]);

  // Filters within active route folder
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedReason, setSelectedReason] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active route claims
  const activeRouteClaims = useMemo(() => {
    if (!selectedRoute) return [];
    return routeGroups[selectedRoute] || [];
  }, [selectedRoute, routeGroups]);

  // Unique products for selected route
  const routeProducts = useMemo(() => {
    const prods = new Set<string>();
    activeRouteClaims.forEach((c) => prods.add(c.productName));
    return Array.from(prods).sort();
  }, [activeRouteClaims]);

  // Filtered claims for active folder
  const filteredClaims = useMemo(() => {
    return activeRouteClaims.filter((claim) => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = claim.clientName.toLowerCase().includes(q);
        const matchesInvoice = claim.invoiceNumber.toLowerCase().includes(q);
        const matchesProduct = claim.productName.toLowerCase().includes(q);
        const matchesPilot = claim.deliveryPerson.toLowerCase().includes(q);
        const matchesVoucher = claim.voucherNumber.toLowerCase().includes(q);
        if (!matchesClient && !matchesInvoice && !matchesProduct && !matchesPilot && !matchesVoucher) {
          return false;
        }
      }

      // Product filter
      if (selectedProduct !== 'ALL' && claim.productName !== selectedProduct) {
        return false;
      }

      // Reason filter
      if (selectedReason !== 'ALL' && claim.reason !== selectedReason) {
        return false;
      }

      // Date range filter
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
  }, [activeRouteClaims, searchQuery, selectedProduct, selectedReason, startDate, endDate]);

  // Metrics for active route folder
  const metrics = useMemo(() => {
    const totalClaims = filteredClaims.length;
    const totalQuantity = filteredClaims.reduce((sum, c) => sum + (c.quantity || 1), 0);

    // Most common product
    const productCounts: { [key: string]: number } = {};
    filteredClaims.forEach((c) => {
      productCounts[c.productName] = (productCounts[c.productName] || 0) + (c.quantity || 1);
    });
    let topProduct = 'N/A';
    let topProductQty = 0;
    Object.entries(productCounts).forEach(([name, count]) => {
      if (count > topProductQty) {
        topProductQty = count;
        topProduct = name;
      }
    });

    // Most common reason
    const reasonCounts: { [key: string]: number } = {};
    filteredClaims.forEach((c) => {
      reasonCounts[c.reason] = (reasonCounts[c.reason] || 0) + 1;
    });
    let topReason = 'N/A';
    let topReasonCount = 0;
    Object.entries(reasonCounts).forEach(([r, count]) => {
      if (count > topReasonCount) {
        topReasonCount = count;
        topReason = r;
      }
    });

    return { totalClaims, totalQuantity, topProduct, topProductQty, topReason, topReasonCount };
  }, [filteredClaims]);

  // Export CSV helper
  const handleExportCSV = () => {
    if (filteredClaims.length === 0) {
      alert('No hay registros para exportar con los filtros actuales.');
      return;
    }

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
      'Detalles'
    ];

    const rows = filteredClaims.map((c) => [
      `"${c.routeId || ''}"`,
      `"${c.voucherNumber}"`,
      `"${c.formattedDate}"`,
      `"${c.formattedTime}"`,
      `"${c.clientName.replace(/"/g, '""')}"`,
      `"${c.invoiceNumber}"`,
      `"${c.vendorName.replace(/"/g, '""')}"`,
      `"${c.deliveryPerson.replace(/"/g, '""')}"`,
      `"${c.productName.replace(/"/g, '""')}"`,
      c.quantity,
      `"${c.unit}"`,
      `"${c.reason}"`,
      `"${c.status}"`,
      `"${(c.reasonDetails || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `expediente_${selectedRoute || 'rutas'}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintFolder = () => {
    window.print();
  };

  const getRouteVendorName = (route: string) => {
    const found = DEFAULT_USERS.find((u) => u.routeId === route);
    return found ? found.vendorName : `${route} - Asignado`;
  };

  // ================= VIEW 1: ADMIN SEES GRID OF ALL 11 ROUTE FOLDERS =================
  if (!selectedRoute) {
    return (
      <div className="space-y-3.5 animate-fade-in pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <Folder className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Carpetas Digitales por Ruta
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Vista del Administrador: Acceda al expediente individual de cada una de las 11 rutas comerciales.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 self-start sm:self-auto">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>11 Carpetas Activas</span>
          </div>
        </div>

        {/* Folders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {ALL_ROUTES.map((route) => {
            const routeClaims = routeGroups[route] || [];
            const vendorName = getRouteVendorName(route);
            const totalQuantity = routeClaims.reduce((acc, c) => acc + (c.quantity || 1), 0);

            return (
              <button
                key={route}
                type="button"
                onClick={() => setSelectedRoute(route)}
                className="bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md rounded-xl p-3.5 text-left transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white text-emerald-700 flex items-center justify-center transition-colors">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 group-hover:bg-emerald-100 group-hover:text-emerald-900 transition-colors">
                      {route}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                    {vendorName}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Expediente Oficial</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-xs sm:text-sm font-black text-slate-900 block leading-none">
                      {routeClaims.length}
                    </strong>
                    <span className="text-[10px] text-slate-400">Reclamos</span>
                  </div>
                  <div className="text-right">
                    <strong className="text-xs sm:text-sm font-black text-emerald-700 block leading-none">
                      {totalQuantity}
                    </strong>
                    <span className="text-[10px] text-slate-400">Unidades</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ================= VIEW 2: SINGLE ROUTE FOLDER EXPEDIENTE =================
  const currentVendorName = isRouteUser ? currentUser.vendorName : getRouteVendorName(selectedRoute);

  return (
    <div className="space-y-3.5 animate-fade-in pb-6">
      {/* Folder Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            {!isRouteUser && (
              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Volver a todas las carpetas"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-slate-900 text-white font-mono">
                  {selectedRoute}
                </span>
                {isRouteUser && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Exclusivo
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Expediente: {currentVendorName}
              </h2>
              <p className="text-[11px] text-slate-500">
                Historial completo de cambios con filtros por fecha, producto y motivo.
              </p>
            </div>
          </div>

          <div className="no-print flex items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrintFolder}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            {clearFolderAction && (currentUser.role === 'ADMIN' || selectedRoute === currentUser.routeId) && filteredClaims.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Seguro que desea eliminar todos los registros de la carpeta ${selectedRoute}? Esta acción no se puede deshacer.`
                    )
                  ) {
                    clearFolderAction(selectedRoute!);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                title="Eliminar todos los registros de esta carpeta"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Vaciar</span>
              </button>
            )}
          </div>
        </div>

        {/* Folder Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[9px] block">
              Total Reclamos
            </span>
            <strong className="text-base sm:text-lg font-black text-slate-900">
              {metrics.totalClaims}
            </strong>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[9px] block">
              Unidades Cambiadas
            </span>
            <strong className="text-base sm:text-lg font-black text-emerald-700">
              {metrics.totalQuantity}
            </strong>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[9px] block">
              Producto Frecuente
            </span>
            <strong className="text-xs font-bold text-slate-800 block truncate" title={metrics.topProduct}>
              {metrics.topProduct}
            </strong>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[9px] block">
              Causa Principal
            </span>
            <strong className="text-xs font-bold text-slate-800 block truncate" title={metrics.topReason}>
              {metrics.topReason}
            </strong>
          </div>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="no-print bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-emerald-600" />
            Filtros de Búsqueda
          </span>
          {(searchQuery || selectedProduct !== 'ALL' || selectedReason !== 'ALL' || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedProduct('ALL');
                setSelectedReason('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
            >
              Restablecer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Text Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, factura, voucher..."
              className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Product Filter */}
          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los Productos ({routeProducts.length})</option>
              {routeProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Filter */}
          <div>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los Motivos</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:ring-2 focus:ring-emerald-500"
              title="Fecha inicial"
            />
            <span className="text-slate-400 text-xs">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:ring-2 focus:ring-emerald-500"
              title="Fecha final"
            />
          </div>
        </div>
      </div>

      {/* Claims Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            {filteredClaims.length} {filteredClaims.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {filteredClaims.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-800">No hay reclamos registrados con estos filtros</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Modifique los filtros o registre un nuevo reclamo para esta ruta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Voucher</th>
                  <th className="py-2.5 px-3">Fecha/Hora</th>
                  <th className="py-2.5 px-3">Cliente y Factura</th>
                  <th className="py-2.5 px-3">Producto Reclamado</th>
                  <th className="py-2.5 px-3 text-center">Cantidad</th>
                  <th className="py-2.5 px-3">Motivo</th>
                  <th className="py-2.5 px-3">Piloto</th>
                  <th className="py-2.5 px-3 text-center">Firmas</th>
                  <th className="py-2.5 px-3 text-right no-print">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-emerald-800">
                      {claim.voucherNumber}
                    </td>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                      {claim.formattedDate} <br />
                      <span className="text-[10px] text-slate-400">{claim.formattedTime}</span>
                    </td>
                    <td className="py-2 px-3">
                      <strong className="block text-slate-900">{claim.clientName}</strong>
                      <span className="font-mono text-[10px] text-slate-500">Factura: {claim.invoiceNumber}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-slate-900 block">{claim.productName}</span>
                      {claim.reasonDetails && (
                        <span className="text-[10px] text-slate-500 truncate block max-w-xs" title={claim.reasonDetails}>
                          {claim.reasonDetails}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className="font-black text-slate-900">{claim.quantity}</span>{' '}
                      <span className="text-[10px] text-slate-500">{claim.unit}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        {claim.reason}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                      {claim.deliveryPerson}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700">
                        <span>✓ Vend.</span>
                        <span>•</span>
                        <span>✓ Cli.</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenVoucher(claim)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                        >
                          Voucher
                        </button>
                        {onDeleteClaim && (currentUser.role === 'ADMIN' || claim.routeId === currentUser.routeId) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  '⚠️ ¿Seguro que desea eliminar este reclamo del historial? Esta acción no se puede deshacer.'
                                )
                              ) {
                                onDeleteClaim(claim.id);
                              }
                            }}
                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            title="Eliminar este registro permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
