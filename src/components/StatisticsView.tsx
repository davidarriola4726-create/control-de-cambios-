import React, { useState, useMemo } from 'react';
import { ProductClaim, UserAccount } from '../types';
import { ALL_ROUTES } from '../data/usersData';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Users,
  Calendar,
  Package,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  FileSpreadsheet,
  Truck,
  Filter
} from 'lucide-react';

interface StatisticsViewProps {
  claims: ProductClaim[];
  currentUser: UserAccount;
}

type PeriodFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

const PIE_COLORS = [
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#2563eb', // Blue 600
  '#dc2626', // Red 600
  '#7c3aed', // Purple 600
  '#0891b2', // Cyan 600
  '#475569', // Slate 600
  '#db2777', // Pink 600
];

export const StatisticsView: React.FC<StatisticsViewProps> = ({ claims, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');

  // Base claims: if route user, strictly their route; if admin, either ALL or selected route
  const baseUserClaims = useMemo(() => {
    if (!isAdmin) {
      return claims.filter((c) => c.routeId === currentUser.routeId);
    }
    if (selectedRouteFilter !== 'ALL') {
      return claims.filter((c) => c.routeId === selectedRouteFilter);
    }
    return claims;
  }, [claims, isAdmin, currentUser.routeId, selectedRouteFilter]);

  // Filter based on selected period
  const filteredClaims = useMemo(() => {
    if (period === 'ALL') return baseUserClaims;

    const now = new Date();
    return baseUserClaims.filter((claim) => {
      const claimDate = new Date(claim.createdAt);
      const diffMs = now.getTime() - claimDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (period === 'TODAY') {
        return diffDays < 1 && claimDate.getDate() === now.getDate();
      }
      if (period === 'WEEK') {
        return diffDays <= 7;
      }
      if (period === 'MONTH') {
        return diffDays <= 31;
      }
      return true;
    });
  }, [baseUserClaims, period]);

  // Total summary figures
  const totalClaimsCount = filteredClaims.length;
  const totalUnitsCount = filteredClaims.reduce((acc, c) => acc + (c.quantity || 1), 0);

  // 1. Top Products by Quantity
  const topProductsData = useMemo(() => {
    const counts: { [product: string]: { quantity: number; claimsCount: number } } = {};

    filteredClaims.forEach((c) => {
      const prod = c.productName || 'Sin Producto';
      if (!counts[prod]) {
        counts[prod] = { quantity: 0, claimsCount: 0 };
      }
      counts[prod].quantity += (c.quantity || 1);
      counts[prod].claimsCount += 1;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 18) + '...' : name,
        fullName: name,
        unidades: data.quantity,
        reclamaciones: data.claimsCount,
      }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 7);
  }, [filteredClaims]);

  // 2. Reasons Pie Chart
  const reasonsData = useMemo(() => {
    const counts: { [reason: string]: number } = {};
    filteredClaims.forEach((c) => {
      const r = c.reason || 'Otro Motivo';
      counts[r] = (counts[r] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredClaims]);

  // 3. Timeline / Dates chart data
  const dateTimelineData = useMemo(() => {
    const counts: { [dateStr: string]: { reclamos: number; unidades: number; timestamp: number } } = {};

    filteredClaims.forEach((c) => {
      const d = c.formattedDate || new Date(c.createdAt).toLocaleDateString('es-GT');
      if (!counts[d]) {
        counts[d] = { reclamos: 0, unidades: 0, timestamp: new Date(c.createdAt).getTime() };
      }
      counts[d].reclamos += 1;
      counts[d].unidades += (c.quantity || 1);
    });

    return Object.entries(counts)
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-12);
  }, [filteredClaims]);

  // 4. For Admin: Route volume comparison
  const routeComparisonData = useMemo(() => {
    const counts: { [route: string]: { claims: number; units: number } } = {};
    ALL_ROUTES.forEach((r) => {
      counts[r] = { claims: 0, units: 0 };
    });

    claims.forEach((c) => {
      const r = c.routeId || 'RUTA-1';
      if (!counts[r]) counts[r] = { claims: 0, units: 0 };
      counts[r].claims += 1;
      counts[r].units += (c.quantity || 1);
    });

    return Object.entries(counts).map(([route, d]) => ({
      route,
      reclamos: d.claims,
      unidades: d.units,
    }));
  }, [claims]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Control Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isAdmin
                  ? 'Estadísticas y Análisis Comparativo MYG'
                  : `Mis Estadísticas: ${currentUser.routeId} (${currentUser.vendorName})`}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAdmin
                ? 'Panel comparativo de volumen por ruta, causas frecuentes y productos con mayor tasa de cambio.'
                : 'Métricas exclusivas de los reclamos y devoluciones tramitados por su ruta.'}
            </p>
          </div>

          {/* Period Filter Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin Route Selector */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedRouteFilter}
                  onChange={(e) => setSelectedRouteFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todas las Rutas (1-11)</option>
                  {ALL_ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setPeriod('TODAY')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  period === 'TODAY'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setPeriod('WEEK')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  period === 'WEEK'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Días
              </button>
              <button
                type="button"
                onClick={() => setPeriod('MONTH')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  period === 'MONTH'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setPeriod('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  period === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo
              </button>
            </div>
          </div>
        </div>

        {/* Global Figures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">
              Total Reclamaciones
            </span>
            <strong className="text-2xl font-black text-slate-900 mt-0.5 block">
              {totalClaimsCount}
            </strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">
              Unidades Devueltas
            </span>
            <strong className="text-2xl font-black text-emerald-700 mt-0.5 block">
              {totalUnitsCount}
            </strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">
              Producto Top Reclamado
            </span>
            <strong className="text-xs font-bold text-slate-800 mt-1 block truncate">
              {topProductsData[0]?.fullName || 'N/A'}
            </strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">
              Causa Prevalente
            </span>
            <strong className="text-xs font-bold text-slate-800 mt-1 block truncate">
              {reasonsData[0]?.name || 'N/A'}
            </strong>
          </div>
        </div>
      </div>

      {/* Admin Route Comparison Chart (Shown when Admin is viewing) */}
      {isAdmin && selectedRouteFilter === 'ALL' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Comparativa de Reclamos por Ruta (1 a 11)
              </h3>
              <p className="text-xs text-slate-500">
                Distribución de expedientes y unidades sustituidas por cada ruta de venta
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              11 Rutas
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="route" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="reclamos" name="Total Reclamos" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="unidades" name="Unidades Devueltas" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two Main Visual Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Productos Más Cambiados */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <div className="pb-3 mb-4 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Productos Más Cambiados
            </h3>
            <p className="text-xs text-slate-500">Ranking por volumen de unidades cambiadas</p>
          </div>

          {topProductsData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-400">
              No hay datos suficientes en este período
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topProductsData}
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="unidades" name="Unidades Cambiadas" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Graph 2: Motivos Más Frecuentes (Pie Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <div className="pb-3 mb-4 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Motivos de Cambio y Reclamación
            </h3>
            <p className="text-xs text-slate-500">Distribución porcentual de causas registradas</p>
          </div>

          {reasonsData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-400">
              No hay datos suficientes en este período
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {reasonsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Graph 3: Historial y Frecuencia por Fechas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Evolución y Registro por Fechas
            </h3>
            <p className="text-xs text-slate-500">
              Historial cronológico de reclamos tramitados y volumen de unidades
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            Por Día
          </span>
        </div>

        {dateTimelineData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-slate-400">
            No hay registros de fechas disponibles en este período
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dateTimelineData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="reclamos"
                  name="N° Reclamos"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="unidades"
                  name="Unidades Reclamadas"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#d97706' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
