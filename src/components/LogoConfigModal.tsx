import React, { useState } from 'react';
import {
  Image,
  Upload,
  Link as LinkIcon,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { parseGoogleDriveLink, DEFAULT_LOGO_URL, LOCAL_STORAGE_LOGO_KEY } from '../utils/logoUtils';

interface LogoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogoUrl?: string;
  onSaveLogo: (newLogoUrl: string) => Promise<void> | void;
}

export const LogoConfigModal: React.FC<LogoConfigModalProps> = ({
  isOpen,
  onClose,
  currentLogoUrl,
  onSaveLogo
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>(currentLogoUrl || DEFAULT_LOGO_URL);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUrlChange = (value: string) => {
    setInputUrl(value);
    setError(null);
    setSuccess(false);

    if (!value.trim()) {
      setPreviewUrl(currentLogoUrl || DEFAULT_LOGO_URL);
      return;
    }

    const parsed = parseGoogleDriveLink(value.trim());
    if (parsed.directUrl) {
      setPreviewUrl(parsed.directUrl);
    } else if (parsed.error) {
      setError(parsed.error);
    } else {
      setPreviewUrl(value.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor seleccione un archivo de imagen válido (PNG, JPG, SVG, WEBP).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('La imagen excede 4MB. Por favor elija una imagen más ligera o ingrese un enlace web.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPreviewUrl(result);
        setInputUrl('');
        setError(null);
        setSuccess(false);
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo de imagen.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefault = () => {
    setInputUrl('');
    setPreviewUrl(DEFAULT_LOGO_URL);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSaveLogo(previewUrl);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError('Error al guardar el logo: ' + (err.message || 'Intente nuevamente'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Image className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Personalizar Logo de la Aplicación</h3>
              <p className="text-[11px] text-slate-300">Visible en el encabezado de todas las pantallas y vouchers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Vista previa actual */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Vista Previa en Tiempo Real
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[90px]">
              <img
                src={previewUrl}
                alt="Vista previa del logo"
                referrerPolicy="no-referrer"
                onError={() => {
                  setError('No se pudo cargar la imagen desde el enlace proporcionado. Asegúrese de que el enlace sea público y directo.');
                }}
                className="max-h-16 w-auto max-w-full object-contain rounded-lg shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 text-center">
              El logo se muestra con tamaño proporcional y sin deformación en el encabezado y comprobantes.
            </p>
          </div>

          {/* Pegar enlace */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pegar Enlace Directo de la Imagen
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <LinkIcon className="w-4 h-4" />
              </span>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://ejemplo.com/mi-logo.png o enlace de Drive..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* O Subir Archivo */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                O Subir Imagen desde el Dispositivo
              </span>
            </div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/40 transition-colors">
              <Upload className="w-5 h-5 text-emerald-600 mb-1" />
              <span className="text-xs font-bold text-slate-700">Seleccionar archivo de imagen</span>
              <span className="text-[10px] text-slate-400">PNG, JPG, WEBP o SVG (máx. 4MB)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Mensajes de error o éxito */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>¡Logo guardado y actualizado con éxito en todas las pantallas!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Logo Original MYG</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Aplicar Logo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
