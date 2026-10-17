import React, { useState } from 'react';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Package,
  Plus,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import Modal from './Modal';
import BarcodeScanner from './BarcodeScanner';
import { batchesApi, QuickScanAddResult } from '../../api/batches';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface QuickBarcodeAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: QuickScanAddResult) => void;
}

const COMMON_DRUGS = [
  { code: '8901234567890', name: 'Paracetamol 650mg' },
  { code: '8901111222333', name: 'Amoxicillin 500mg' },
  { code: '8902222333444', name: 'Metformin 500mg' },
  { code: '8903333444555', name: 'Azithromycin 500mg' },
  { code: '8904444555666', name: 'Insulin Glargine' },
  { code: '8905555666777', name: 'Pantoprazole 40mg' },
  { code: '8902000222333', name: 'Meropenem 1g' },
  { code: '8901000111222', name: 'ORS Sachet' },
];

export const QuickBarcodeAddModal: React.FC<QuickBarcodeAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [expiryPreset, setExpiryPreset] = useState<'18m' | '12m' | '24m' | '6m'>('18m');
  const [autoAddOnScan, setAutoAddOnScan] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<QuickScanAddResult | null>(null);

  const calculateExpiryDate = (preset: '18m' | '12m' | '24m' | '6m'): string => {
    const d = new Date();
    if (preset === '6m') d.setMonth(d.getMonth() + 6);
    else if (preset === '12m') d.setFullYear(d.getFullYear() + 1);
    else if (preset === '18m') d.setMonth(d.getMonth() + 18);
    else if (preset === '24m') d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().slice(0, 10);
  };

  const executeDirectAdd = async (barcodeToAdd: string) => {
    const cleanCode = barcodeToAdd.trim();
    if (!cleanCode) {
      toast.error('Please scan or enter a medicine barcode');
      return;
    }

    setLoading(true);
    try {
      const expDate = calculateExpiryDate(expiryPreset);
      const res = await batchesApi.quickScanAdd({
        barcode: cleanCode,
        hospital_id: user?.hospital_id,
        quantity,
        expiry_date: expDate,
      });

      setLastResult(res);
      toast.success(res.message);
      if (onSuccess) onSuccess(res);
      setBarcode('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to directly add medicine via barcode scan';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeDetected = (scannedCode: string) => {
    setBarcode(scannedCode);
    if (autoAddOnScan) {
      executeDirectAdd(scannedCode);
    } else {
      toast.success(`Barcode detected: ${scannedCode}. Click 'Directly Add to Stock'.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setLastResult(null);
        onClose();
      }}
      title="Direct Medicine Inward via Barcode Scanner"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Header alert */}
        <div className="p-3 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent border border-teal-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-teal-900 block">
                Instant 1-Click Medicine Intake
              </span>
              <span className="text-[11px] text-teal-700">
                Scan any box barcode. Medicine is automatically matched/cataloged and stock is credited instantly!
              </span>
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-teal-900 cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-teal-200 shadow-2xs">
            <input
              type="checkbox"
              checked={autoAddOnScan}
              onChange={(e) => setAutoAddOnScan(e.target.checked)}
              className="accent-teal-600 rounded"
            />
            <span>Auto-Add on Scan</span>
          </label>
        </div>

        {/* Live Camera Scanner */}
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
          <span className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-teal-600" />
            Camera Barcode Scanner
          </span>
          <BarcodeScanner
            label="Open Live Camera Scanner"
            onDetected={handleBarcodeDetected}
            showDemoChips={false}
          />
        </div>

        {/* Manual Barcode Input or USB Scanner */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Medicine GTIN / Barcode
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    executeDirectAdd(barcode);
                  }
                }}
                placeholder="Scan with USB barcode reader or type GTIN..."
                className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>
            <button
              type="button"
              disabled={loading || !barcode.trim()}
              onClick={() => executeDirectAdd(barcode)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Direct Add</span>
            </button>
          </div>
        </div>

        {/* 1-Click Sample Drug Chips */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            1-Click Sample Medicines (Click to Instantly Scan & Add):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {COMMON_DRUGS.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setBarcode(item.code);
                  executeDirectAdd(item.code);
                }}
                className="p-2 text-left bg-white hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-lg transition-all group"
              >
                <div className="text-[11px] font-bold text-slate-800 group-hover:text-teal-900 truncate">
                  {item.name}
                </div>
                <div className="text-[10px] font-mono text-slate-400 group-hover:text-teal-700">
                  {item.code}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity & Shelf Life Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Quantity to Inward (Units)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-24 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex gap-1">
                {[50, 100, 200, 500].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuantity(qty)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md border transition-colors ${
                      quantity === qty
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shelf Life Expiry Preset
            </label>
            <div className="flex gap-1.5">
              {[
                { id: '18m', label: '18 Mos (Std)' },
                { id: '24m', label: '2 Yrs' },
                { id: '12m', label: '1 Yr' },
                { id: '6m', label: '6 Mos' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setExpiryPreset(p.id as any)}
                  className={`flex-1 py-1 px-1.5 text-[11px] font-bold rounded-md border transition-colors ${
                    expiryPreset === p.id
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Result Confirmation Card */}
        {lastResult && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-900">
                  Successfully Added to Inventory
                </span>
              </div>
              <span className="font-mono text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900 font-bold">
                Lot #{lastResult.batch_number}
              </span>
            </div>

            <p className="text-xs text-emerald-800">
              {lastResult.message}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-emerald-900">
              <div className="bg-white/80 p-1.5 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">Added Now</span>
                <span className="font-bold text-emerald-900">+{lastResult.added_quantity} Units</span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">Total Hospital Stock</span>
                <span className="font-bold text-emerald-900">{lastResult.available_quantity} Units</span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">Expiry Horizon</span>
                <span className="font-bold text-emerald-900">{lastResult.days_to_expiry} Days</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setLastResult(null);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickBarcodeAddModal;

