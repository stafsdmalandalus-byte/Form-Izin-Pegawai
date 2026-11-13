import React, { useRef, useState, useEffect } from 'react';
import { Eraser, CheckCircle2, PenTool, Maximize2, Minimize2, Smartphone } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  signerName: string;
  signerRole: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  signerName,
  signerRole,
  value,
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(Boolean(value));
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);

  const initCanvasContext = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#064e3b'; // Hijau tua resmi Al-Andalus / tinta formal
    return ctx;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = initCanvasContext(canvas);
    if (!ctx) return;

    if (value && value.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasStrokes(true);
      };
      img.src = value;
    } else if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasStrokes(false);
    }
  }, [value, isMobileFullscreen]);

  const getPointerCoordinates = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getPointerCoordinates(e);
    if (!coords) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = initCanvasContext(canvas);
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const coords = getPointerCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasStrokes(true);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture already released
    }
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png');
      onChange(pngUrl);
      setHasStrokes(true);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onChange('');
  };

  const renderCanvasArea = (heightClass: string) => (
    <div className="relative border-2 border-dashed border-emerald-800/40 rounded-lg bg-slate-50 overflow-hidden select-none">
      {/* Garis bantu tanda tangan */}
      <div className="pointer-events-none absolute inset-x-8 bottom-9 border-b border-slate-300/80" />
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`w-full ${heightClass} touch-none select-none ${
          disabled ? 'cursor-not-allowed opacity-75' : 'cursor-crosshair'
        }`}
      />
      {!hasStrokes && !disabled && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
          <PenTool className="w-6 h-6 mb-1.5 text-emerald-800/60" />
          <span className="text-xs font-medium text-slate-600">
            Sentuh & goreskan jari langsung di layar HP Anda (atau gunakan mouse)
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5">
            Tanda tangan otomatis disimpan sebagai gambar PNG transparan
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="border border-slate-200 rounded-lg bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-900" />
              <p className="text-sm font-semibold text-slate-900">{label}</p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Penandatangan: <span className="font-medium text-slate-800">{signerName}</span> ·{' '}
              {signerRole}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasStrokes && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tersimpan (PNG)
              </span>
            )}
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => setIsMobileFullscreen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Layar Penuh HP
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Hapus & Ulangi
                </button>
              </>
            )}
          </div>
        </div>

        {!isMobileFullscreen && renderCanvasArea('h-44 sm:h-48')}

        <p className="mt-2 text-xs text-slate-500">
          Mendukung layar sentuh HP (Android / iPhone) & Mouse · Format PNG Resmi · Terikat pada akun{' '}
          <strong>{signerName}</strong>.
        </p>
      </div>

      {/* MODE LAYAR PENUH HP (FULLSCREEN MOBILE SIGNATURE MODAL) */}
      {isMobileFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col justify-between p-4">
          <div className="bg-white rounded-t-xl px-4 py-3 flex items-center justify-between border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Mode Tanda Tangan Layar HP — {signerName}
              </h4>
              <p className="text-xs text-slate-500">
                Goreskan tanda tangan dengan jari Anda pada kotak putih di bawah ini
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileFullscreen(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-md"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Kecilkan
            </button>
          </div>

          <div className="bg-white p-4 flex-1 flex flex-col justify-center">
            {renderCanvasArea('h-64 sm:h-80')}
          </div>

          <div className="bg-white rounded-b-xl px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              <Eraser className="w-4 h-4" />
              Hapus & Ulangi
            </button>
            <button
              type="button"
              onClick={() => setIsMobileFullscreen(false)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              Selesai & Gunakan Tanda Tangan Ini
            </button>
          </div>
        </div>
      )}
    </>
  );
};
