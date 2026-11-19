import React, { useRef, useState, useEffect } from 'react';
import {
  Eraser,
  CheckCircle2,
  PenTool,
  Maximize2,
  Minimize2,
  Smartphone,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const hasValidSignature = (dataUrl?: string | null): boolean => {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  const trimmed = dataUrl.trim();
  return trimmed.startsWith('data:image/') && trimmed.length > 200;
};

const getSavedSignatureStorageKey = (storageKey?: string, signerName?: string): string | null => {
  const raw = (storageKey || signerName || '').trim().toLowerCase();
  if (!raw) return null;
  const safe = raw.replace(/[^a-z0-9_-]/g, '_');
  return `SIM_SDM_SAVED_SIG_V1_${safe}`;
};

export const loadSavedSignatureForUser = (storageKey?: string, signerName?: string): string => {
  if (typeof window === 'undefined') return '';
  const key = getSavedSignatureStorageKey(storageKey, signerName);
  if (!key) return '';
  try {
    const val = localStorage.getItem(key) || '';
    return hasValidSignature(val) ? val : '';
  } catch {
    return '';
  }
};

export const saveSignatureForUser = (
  dataUrl: string,
  storageKey?: string,
  signerName?: string
): void => {
  if (typeof window === 'undefined' || !hasValidSignature(dataUrl)) return;
  const key = getSavedSignatureStorageKey(storageKey, signerName);
  if (!key) return;
  try {
    localStorage.setItem(key, dataUrl);
  } catch {
    // ignore quota errors
  }
};

interface SignaturePadProps {
  label: string;
  signerName: string;
  signerRole: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  required?: boolean;
  showError?: boolean;
  storageKey?: string;
}

const MIN_INKED_PIXELS = 60;

const countInkedPixels = (canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    // Periksa kanal alpha (setiap 4 byte) untuk menghitung piksel tinta nyata
    for (let i = 3; i < imgData.length; i += 4) {
      if (imgData[i] > 20) {
        count++;
        if (count >= MIN_INKED_PIXELS) return count;
      }
    }
    return count;
  } catch {
    return MIN_INKED_PIXELS;
  }
};

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  signerName,
  signerRole,
  value,
  onChange,
  disabled = false,
  required = true,
  showError = false,
  storageKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(hasValidSignature(value));
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [shortStrokeHint, setShortStrokeHint] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string>(() =>
    loadSavedSignatureForUser(storageKey, signerName)
  );

  useEffect(() => {
    setSavedSignature(loadSavedSignatureForUser(storageKey, signerName));
  }, [storageKey, signerName]);

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

    if (hasValidSignature(value)) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasStrokes(true);
        setShortStrokeHint(false);
      };
      img.src = value!;
    } else {
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
    setShortStrokeHint(false);
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
      const inked = countInkedPixels(canvas);
      if (inked >= MIN_INKED_PIXELS) {
        const pngUrl = canvas.toDataURL('image/png');
        setHasStrokes(true);
        setShortStrokeHint(false);
        saveSignatureForUser(pngUrl, storageKey, signerName);
        setSavedSignature(pngUrl);
        onChange(pngUrl);
      } else {
        // Sentuhan tak sengaja / goresan terlalu pendek -> tidak dianggap sah
        const ctx = canvas.getContext('2d');
        if (ctx && !hasValidSignature(value)) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasStrokes(hasValidSignature(value));
        setShortStrokeHint(true);
        if (!hasValidSignature(value)) {
          onChange('');
        }
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    setShortStrokeHint(false);
    onChange('');
  };

  const handleApplySavedSignature = () => {
    if (!savedSignature || disabled) return;
    setHasStrokes(true);
    setShortStrokeHint(false);
    onChange(savedSignature);
  };

  const isSignedValid = hasValidSignature(value) || hasStrokes;

  const renderCanvasArea = (heightClass: string) => (
    <div
      className={`relative border-2 border-dashed rounded-lg overflow-hidden select-none transition-colors ${
        isSignedValid
          ? 'border-emerald-600 bg-slate-50'
          : showError
          ? 'border-red-500 bg-red-50/40'
          : 'border-amber-500/80 bg-amber-50/20'
      }`}
    >
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
      {!isSignedValid && !disabled && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
          <PenTool className="w-6 h-6 mb-1.5 text-emerald-800/70" />
          <span className="text-xs font-semibold text-slate-700">
            Sentuh & goreskan tanda tangan langsung di sini (layar HP / mouse)
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5">
            Tanda tangan otomatis disimpan agar lain kali cukup 1 klik
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className={`border-2 rounded-xl bg-white p-4 transition-colors ${
          isSignedValid
            ? 'border-emerald-500/70'
            : showError
            ? 'border-red-500 ring-2 ring-red-200'
            : required
            ? 'border-amber-400'
            : 'border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-900 shrink-0" />
              <p className="text-sm font-bold text-slate-900">{label}</p>
              {required && !isSignedValid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-red-100 text-red-800 rounded">
                  <AlertTriangle className="w-3 h-3" />
                  WAJIB DIISI
                </span>
              )}
              {isSignedValid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  Tanda Tangan Sah
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Penandatangan: <span className="font-medium text-slate-800">{signerName}</span> ·{' '}
              {signerRole}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!disabled && savedSignature && !isSignedValid && (
              <button
                type="button"
                onClick={handleApplySavedSignature}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-md shadow-2xs transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Pakai TTD Tersimpan (1 Klik)
              </button>
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

        {shortStrokeHint && !isSignedValid && (
          <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Goresan terlalu singkat atau hanya sentuhan biasa. Mohon goreskan tanda tangan lengkap Anda.
            </span>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Mendukung layar sentuh HP (Android / iPhone) & Mouse · TTD tersimpan otomatis di perangkat untuk akun{' '}
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
                Goreskan tanda tangan dengan jari Anda pada kotak di bawah ini
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
              disabled={!isSignedValid}
              onClick={() => setIsMobileFullscreen(false)}
              className={`inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold rounded-md transition-colors ${
                isSignedValid
                  ? 'text-white bg-emerald-900 hover:bg-emerald-800'
                  : 'text-slate-400 bg-slate-200 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSignedValid ? 'Selesai & Gunakan Tanda Tangan Ini' : 'Goreskan Tanda Tangan Dulu'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
