import React, { useState } from 'react';
import { UserAccount } from '../types';
import { DEFAULT_USERS } from '../data/usersData';
import {
  Lock,
  User,
  KeyRound,
  LogIn,
  AlertCircle,
  Info
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserAccount) => void;
  onClose?: () => void;
  canClose?: boolean;
  logoUrl?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLoginSuccess,
  onClose,
  canClose = false,
  logoUrl
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (inputUser?: string, inputPass?: string) => {
    const userToTry = (inputUser !== undefined ? inputUser : username).trim();
    const passToTry = (inputPass !== undefined ? inputPass : password).trim();

    if (!userToTry || !passToTry) {
      setError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try server API login
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToTry, password: passToTry })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          onLoginSuccess(data.user);
          setLoading(false);
          return;
        }
      }

      // If server returned 401 or failed, check local predefined list as fallback
      const cleanUser = userToTry.trim().toUpperCase();
      const cleanPass = passToTry.trim();
      const localMatch = DEFAULT_USERS.find(
        (u) =>
          u.username.toUpperCase() === cleanUser &&
          (u.password === cleanPass || u.password.toLowerCase() === cleanPass.toLowerCase())
      );

      if (localMatch) {
        const { password: _, ...safeUser } = localMatch;
        onLoginSuccess(safeUser as UserAccount);
      } else {
        setError('Usuario o contraseña incorrectos. Verifique sus credenciales asignadas.');
      }
    } catch (e) {
      // Offline fallback
      const cleanUser = userToTry.trim().toUpperCase();
      const cleanPass = passToTry.trim();
      const localMatch = DEFAULT_USERS.find(
        (u) =>
          u.username.toUpperCase() === cleanUser &&
          (u.password === cleanPass || u.password.toLowerCase() === cleanPass.toLowerCase())
      );
      if (localMatch) {
        const { password: _, ...safeUser } = localMatch;
        onLoginSuccess(safeUser as UserAccount);
      } else {
        setError('Error de conexión o credenciales no válidas.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-fade-in">
        {/* Header compacto con identidad visual MYG */}
        <div className="bg-[#272d34] px-4 py-3 sm:py-3.5 text-white text-center relative border-b border-slate-700/50">
          <div className="w-full flex justify-center items-center mb-1">
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
              className="h-10 sm:h-12 w-auto max-w-[200px] object-contain mx-auto block drop-shadow-sm select-none"
            />
          </div>
          <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400 block leading-tight">
            Acceso Seguro por Rol y Ruta
          </span>
          <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug mt-0.5">
            Control de Cambios y Reclamaciones
          </h2>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">
            Ingrese con su usuario de Ruta o Administrador
          </p>

          {canClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-sm cursor-pointer p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Formulario de Login Compacto y Proporcional */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="p-4 sm:p-5 space-y-3"
        >
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Usuario (Ruta o Admin)
              </label>
              <span className="text-[10px] text-emerald-600 font-semibold">
                Mayús / minús
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. RUTA-1, ruta-1, Admin o admin"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Acepta mayúsculas o minúsculas (ej. ruta-1, RUTA-1, admin)
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Contraseña
              </label>
              <span className="text-[10px] text-emerald-600 font-semibold">
                Mayús / minús
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su clave asignada"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Acepta mayúsculas y minúsculas (ej. Mg2026, mg2026, mgyg)
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Verificando...' : 'Iniciar Sesión'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
