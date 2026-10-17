import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine, Check, Barcode } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

interface DetectedBarcode { rawValue: string }
interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
}

interface BarcodeScannerProps {
  onDetected: (value: string) => void;
  label?: string;
  showDemoChips?: boolean;
}

const COMMON_DEMO_BARCODES = [
  { code: '8901234567890', name: 'Paracetamol 650mg' },
  { code: '8901111222333', name: 'Amoxicillin 500mg' },
  { code: '8902222333444', name: 'Metformin 500mg' },
  { code: '8903333444555', name: 'Azithromycin 500mg' },
  { code: '8904444555666', name: 'Insulin Glargine' },
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onDetected,
  label = 'Scan Barcode',
  showDemoChips = true,
}) => {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [recentScanned, setRecentScanned] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onDetected);
  callbackRef.current = onDetected;

  const triggerDetection = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    setRecentScanned(clean);
    callbackRef.current(clean);
    setTimeout(() => setRecentScanned(null), 3000);
  };

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | undefined;
    let scannerControls: IScannerControls | undefined;
    let frame = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      scannerControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const start = async () => {
      const Detector = (window as Window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access needs HTTPS (or localhost) and browser permission. Use a secure app URL, sample barcodes, or manual entry.');
        return;
      }
      try {
        const video = videoRef.current;
        if (!video) return;

        if (Detector) {
          try {
            const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'] });
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
            video.srcObject = stream;
            await video.play();
            const scan = async () => {
              if (stopped || !videoRef.current) return;
              try {
                const results = await detector.detect(videoRef.current);
                const value = results[0]?.rawValue?.trim();
                if (value) {
                  triggerDetection(value);
                  setActive(false);
                  return;
                }
              } catch { /* Keep scanning while the camera adjusts. */ }
              if (!stopped) frame = requestAnimationFrame(scan);
            };
            frame = requestAnimationFrame(scan);
            return;
          } catch (cause) {
            if (cause instanceof Error && ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(cause.name)) {
              throw cause;
            }
            // Fall through to ZXing if the native detector or its format list is unavailable.
            stream?.getTracks().forEach((track) => track.stop());
            stream = undefined;
            video.srcObject = null;
          }
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped) return;
        const reader = new BrowserMultiFormatReader();
        scannerControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          const value = result?.getText().trim();
          if (value && !stopped) {
            triggerDetection(value);
            setActive(false);
          }
        });
        if (stopped) {
          scannerControls.stop();
          return;
        }
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        const message = cause instanceof Error && cause.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access in the browser settings, or use sample barcodes/manual entry.'
          : 'Could not access the camera. Use HTTPS or localhost, allow camera permission, or use sample barcodes/manual entry.';
        setError(message);
      }
    };

    setError('');
    void start();
    return stop;
  }, [active]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActive((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors shadow-2xs"
        >
          {active ? <CameraOff className="h-4 w-4 text-teal-700" /> : <ScanLine className="h-4 w-4 text-teal-700" />}
          <span>{active ? 'Stop Camera' : label}</span>
        </button>

        {recentScanned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md animate-pulse">
            <Check className="h-3 w-3" />
            Scanned: {recentScanned}
          </span>
        )}
      </div>

      {active && (
        <div className="overflow-hidden rounded-xl border-2 border-teal-500 bg-slate-950 relative shadow-md">
          <video ref={videoRef} muted playsInline className="max-h-52 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 flex items-center justify-between text-xs text-white">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Camera className="h-3.5 w-3.5 text-teal-400" /> Align barcode within camera frame
            </span>
            <button
              type="button"
              onClick={() => setActive(false)}
              className="text-[11px] text-teal-300 underline hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="status" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
          {error}
        </p>
      )}

      {showDemoChips && (
        <div className="pt-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1">
            <Barcode className="w-3 h-3 text-teal-600" />
            <span>Click to Simulate Barcode Scan:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_DEMO_BARCODES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => triggerDetection(item.code)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-slate-100 hover:bg-teal-100 hover:border-teal-300 border border-slate-200 text-slate-700 rounded transition-all"
                title={item.name}
              >
                <span>{item.code}</span>
                <span className="text-[9px] text-slate-400 font-sans">({item.name.split(' ')[0]})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
