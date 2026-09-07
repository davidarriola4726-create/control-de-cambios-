import React, { useState } from 'react';
import { UserAccount } from '../types';
import { DEFAULT_USERS } from '../data/usersData';
import {
  Users,
  Shield,
  Truck,
  KeyRound,
  RotateCcw,
  Check,
  Search,
  Lock,
  Calendar,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface AdminUsersViewProps {
  currentUser: UserAccount;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.vendorName.toLowerCase().includes(q) ||
      (u.routeId && u.routeId.toLowerCase().includes(q))
    );
  });

  const handleResetPassword = async (target: UserAccount) => {
    const promptPass = prompt(
      `Ingrese la nueva contraseña para el usuario ${target.username}:`,
      target.username === 'RUTA-9' ? 'Mmig' : target.username === 'Admin' ? 'Mg2026' : 'Mgyg'
    );
    if (!promptPass || !promptPass.trim()) return;

    setLoading(true);
    setResetMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: target.username,
          newPassword: promptPass.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetMessage(`Contraseña de ${target.username} actualizada a: ${promptPass.trim()}`);
        setUsers((prev) =>
          prev.map((u) => (u.id === target.id ? { ...u, password: promptPass.trim() } : u))
        );
      } else {
        setErrorMessage(data.message || 'Error al actualizar contraseña');
      }
    } catch (e) {
      // Local fallback
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, password: promptPass.trim() } : u))
      );
      setResetMessage(`Contraseña de ${target.username} actualizada localmente`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Principal */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Panel Administrativo
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Gestión de Rutas y Credenciales de Acceso
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Administre los accesos exclusivos para cada una de las 11 rutas y restablezca contraseñas.
              </p>
            </div>
          </div>

          <div className="text-xs bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-slate-400 block">Total Usuarios Registrados</span>
            <strong className="text-base text-emerald-400">{users.length} Cuentas</strong>
          </div>
        </div>
      </div>

      {resetMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{resetMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Buscador de Usuarios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ruta o nombre de vendedor..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Mostrando {filteredUsers.length} cuentas
        </span>
      </div>

      {/* Grid de Usuarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const isAdmin = user.role === 'ADMIN';

          return (
            <div
              key={user.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                isAdmin
                  ? 'border-amber-300 bg-gradient-to-br from-white via-white to-amber-50/30 ring-1 ring-amber-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-2 rounded-xl text-xs font-bold ${
                        isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {isAdmin ? <Shield className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        {user.username}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isAdmin ? 'Acceso Total a Todo el Sistema' : `Ruta: ${user.routeId}`}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isAdmin
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Vendedor Asignado
                    </span>
                    <strong className="text-slate-800">{user.vendorName}</strong>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Clave actual / predefinida:</span>
                    <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900 font-bold">
                      {user.password || (user.username === 'RUTA-9' ? 'Mmig' : user.username === 'Admin' ? 'Mg2026' : 'Mgyg')}
                    </code>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {user.lastLogin ? `Último ingreso: ${user.lastLogin}` : 'Sin ingresos registrados'}
                </span>

                <button
                  type="button"
                  onClick={() => handleResetPassword(user)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restablecer Clave</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
