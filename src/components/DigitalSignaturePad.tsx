import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';

interface DigitalSignaturePadProps {
  label: string;
  signeeName: string;
  signeeRole: 'Vendedor' | 'Cliente';
  value?: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  label,
  signeeName,
  signeeRole,
  value,
  onChange,
  required = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f172a'; // slate-900 ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If initial value exists and is an image
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    setIsDrawing(true);
    setLastPoint(coords);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPoint) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPoint = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    setLastPoint(currentPoint);
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPoint(null);

    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onChange('');
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <PenTool className="w-4 h-4 text-emerald-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {hasSignature && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3" /> Firmado
          </span>
        )}
      </div>

      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-white p-1 hover:border-emerald-400 transition-colors shadow-xs">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 bg-white cursor-crosshair rounded-lg touch-none"
        />

        {/* Guidance Baseline Line */}
        <div className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-slate-200 flex justify-between text-[11px] text-slate-400">
          <span>✍️ Dibuje su firma aquí (pantalla o ratón)</span>
          <span>{signeeRole}</span>
        </div>

        {/* Clear action */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {hasSignature && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-md transition-colors border border-slate-200 hover:border-rose-200"
              title="Borrar y volver a firmar"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500 px-1">
        <span>Aclaración: <strong className="text-slate-700">{signeeName || 'Sin especificar'}</strong></span>
        <span className="italic text-[11px]">Válido legalmente para entrega y recepción</span>
      </div>
    </div>
  );
};
