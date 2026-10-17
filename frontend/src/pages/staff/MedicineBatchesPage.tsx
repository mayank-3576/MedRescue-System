import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  ThermometerSnowflake,
  AlertTriangle,
  CloudSun,
  Wind,
  Droplets,
  Activity,
  Sparkles,
  ShieldCheck,
  Check,
  HelpCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Barcode,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Badge from '../../components/common/Badge';
import QuickBarcodeAddModal from '../../components/common/QuickBarcodeAddModal';
import { batchesApi } from '../../api/batches';
import { medicinesApi } from '../../api/medicines';
import { useAuth } from '../../hooks/useAuth';
import { MedicineBatch, Medicine } from '../../types';
import toast from 'react-hot-toast';
import BarcodeScanner from '../../components/common/BarcodeScanner';
import { forecastsApi, QuantityForecast } from '../../api/forecasts';
import { demandsApi } from '../../api/demands';

const batchFormSchema = z.object({
  medicine_id: z.string().min(1, 'Please select a medicine'),
  batch_number: z.string().min(3, 'Batch number is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  expiry_date: z.string().min(8, 'Expiry date is required'),
  manufacturing_date: z.string().min(8, 'Manufacturing date is required'),
  unit_price: z.number().min(1, 'Unit price required'),
  unit_purchase_cost: z.number().min(0, 'Purchase cost cannot be negative'),
  storage_condition: z.string().optional(),
});

type BatchFormData = z.infer<typeof batchFormSchema>;

export const MedicineBatchesPage: React.FC = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcodeLookup, setBarcodeLookup] = useState('');
  const [selectedMedicineName, setSelectedMedicineName] = useState<string>('');

  // Predictable AI & Environmental Simulation State
  const [forecastMedicineId, setForecastMedicineId] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(30);
  const [season, setSeason] = useState('monsoon');
  const [temperature, setTemperature] = useState(32);
  const [humidity, setHumidity] = useState(78);
  const [aqi, setAqi] = useState(240);
  const [outbreakRisk, setOutbreakRisk] = useState('moderate');
  const [explainerProvider, setExplainerProvider] = useState('rules');
  const [showXaiAudit, setShowXaiAudit] = useState(false);

  const [forecast, setForecast] = useState<QuantityForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Demand record form state
  const [demandQuantity, setDemandQuantity] = useState(100);
  const [demandPriority, setDemandPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [demandDate, setDemandDate] = useState(new Date().toISOString().slice(0, 10));

  const [modalOpen, setModalOpen] = useState(false);
  const [quickScanModalOpen, setQuickScanModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<MedicineBatch | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<MedicineBatch | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
  });

  const selectedMedId = watch('medicine_id');

  // Barcode Lookup logic: auto-matches catalog medicine and populates batch entry form
  const lookupMedicineBarcode = (value: string) => {
    const barcode = value.trim();
    setBarcodeLookup(barcode);
    if (!barcode) return;

    const medicine = medicines.find((item) => item.barcode?.toLowerCase() === barcode.toLowerCase());
    if (!medicine) {
      toast.error(`No medicine matching barcode '${barcode}' in master catalog.`);
      return;
    }

    setValue('medicine_id', medicine.id, { shouldValidate: true });
    setSelectedMedicineName(`${medicine.name} (${medicine.strength})`);
    setValue('unit_price', medicine.unit_price);
    setValue('storage_condition', medicine.requires_cold_chain ? 'Cold Chain (2°C - 8°C)' : 'Room Temp (< 25°C)');
    toast.success(`Barcode Scanned! Auto-selected ${medicine.name}`);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, medData] = await Promise.all([
        batchesApi.getAll({
          hospital_id: hospitalId,
          search: search || undefined,
        }),
        medicinesApi.getAll(),
      ]);
      setBatches(batchData);
      setMedicines(medData);
      if (!forecastMedicineId && medData.length) setForecastMedicineId(medData[0].id);
    } catch (e) {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, hospitalId]);

  // Run Predictable AI according to Environment
  const runForecast = async () => {
    if (!forecastMedicineId) return;
    setForecastLoading(true);
    try {
      const res = await forecastsApi.quantity({
        medicineId: forecastMedicineId,
        hospitalId: hospitalId,
        horizonDays: forecastHorizon,
        season,
        temperature,
        humidity,
        aqi,
        outbreakRisk,
        provider: explainerProvider,
      });
      setForecast(res);
      toast.success('Predictable AI: Environmental forecast calculated!');
    } catch {
      toast.error('Could not calculate environmental forecast');
    } finally {
      setForecastLoading(false);
    }
  };

  const recordDemand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!forecastMedicineId || demandQuantity < 1) return;
    try {
      await demandsApi.create({
        hospital_id: hospitalId,
        medicine_id: forecastMedicineId,
        required_quantity: demandQuantity,
        priority: demandPriority,
        demand_date: demandDate,
        notes: 'Staff-entered clinical demand record for quantity forecasting.',
      });
      toast.success('Demand record saved');
      setForecast(null);
      runForecast();
    } catch {
      toast.error('Could not save demand record');
    }
  };

  // When medicine changes in modal, auto-populate unit price
  useEffect(() => {
    if (selectedMedId) {
      const med = medicines.find((m) => m.id === selectedMedId);
      if (med) {
        setSelectedMedicineName(`${med.name} (${med.strength})`);
        setValue('unit_price', med.unit_price);
        setValue(
          'storage_condition',
          med.requires_cold_chain ? 'Cold Chain (2°C - 8°C)' : 'Room Temp (< 25°C)'
        );
      }
    }
  }, [selectedMedId, medicines, setValue]);

  const handleOpenAdd = () => {
    setEditingBatch(null);
    setBarcodeLookup('');
    setSelectedMedicineName(medicines[0]?.name || '');
    reset({
      medicine_id: medicines[0]?.id || '',
      batch_number: `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      quantity: 100,
      expiry_date: '2026-12-31',
      manufacturing_date: '2025-01-01',
      unit_price: medicines[0]?.unit_price || 500,
      unit_purchase_cost: 350,
      storage_condition: 'Room Temp (< 25°C)',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (b: MedicineBatch) => {
    setEditingBatch(b);
    const med = medicines.find((m) => m.id === b.medicine_id);
    setSelectedMedicineName(med?.name || '');
    setBarcodeLookup(med?.barcode || '');
    reset({
      medicine_id: b.medicine_id,
      batch_number: b.batch_number,
      quantity: b.quantity,
      expiry_date: b.expiry_date,
      manufacturing_date: b.manufacturing_date,
      unit_price: b.unit_price,
      unit_purchase_cost: b.unit_purchase_cost ?? 0,
      storage_condition: b.storage_condition || '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: BatchFormData) => {
    try {
      const med = medicines.find((m) => m.id === data.medicine_id);
      if (editingBatch) {
        await batchesApi.update(editingBatch.id, {
          ...data,
          medicine: med,
        });
        toast.success('Batch details updated');
      } else {
        await batchesApi.create({
          ...data,
          hospital_id: hospitalId,
          status: 'active',
          medicine: med,
        });
        toast.success('New batch registered into hospital pharmacy');
      }
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to save batch';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!batchToDelete) return;
    try {
      await batchesApi.delete(batchToDelete.id);
      toast.success('Batch record removed');
      setDeleteConfirmOpen(false);
      setBatchToDelete(null);
      loadData();
    } catch (e) {
      toast.error('Failed to delete batch');
    }
  };

  const columns: Column<MedicineBatch>[] = [
    {
      key: 'batch_number',
      header: 'Lot / Batch Number',
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-mono font-bold text-slate-900 block text-xs">{b.batch_number}</span>
          <span className="text-[11px] text-slate-500">Mfg: {b.manufacturing_date}</span>
        </div>
      ),
    },
    {
      key: 'medicine',
      header: 'Formulation & GTIN',
      render: (b) => (
        <div>
          <span className="font-semibold text-slate-900 block">{b.medicine?.name}</span>
          <span className="text-xs text-slate-500">
            {b.medicine?.generic_name} • {b.medicine?.strength}
          </span>
          {b.medicine?.barcode && (
            <span className="text-[10px] font-mono text-teal-700 block mt-0.5">
              GTIN/Barcode: {b.medicine.barcode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Stock Units',
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-semibold text-slate-900 block">{b.quantity.toLocaleString()}</span>
          {(b.reserved_quantity ?? 0) > 0 && (
            <span className="text-[10px] text-amber-600 font-medium">
              ({b.reserved_quantity} reserved)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Expiry Horizon',
      sortable: true,
      render: (b) => (
        <div>
          <span className="text-xs font-semibold text-slate-800 block">{b.expiry_date}</span>
          <span className="text-[11px] text-slate-500">{b.days_to_expiry} days remaining</span>
        </div>
      ),
    },
    {
      key: 'storage_condition',
      header: 'Storage Protocols',
      render: (b) => (
        <span className="text-xs text-slate-600 flex items-center gap-1.5">
          <ThermometerSnowflake className="w-3.5 h-3.5 text-teal-500" />
          {b.storage_condition || 'Room Temp (< 25°C)'}
        </span>
      ),
    },
    {
      key: 'risk_level',
      header: 'Risk Classification',
      sortable: true,
      render: (b) => (
        <Badge variant={b.risk_level || 'low'} size="sm">
          {(b.risk_level || 'LOW').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (b) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(b)}
            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            title="Edit Batch"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setBatchToDelete(b);
              setDeleteConfirmOpen(true);
            }}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Batch"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Medicine Batch Lifecycle & Predictable AI"
        subtitle="Manage pharmaceutical lots, barcode scanning, and environmental AI quantity forecasting."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickScanModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              <Barcode className="w-4 h-4 text-teal-400" />
              <span>Direct Barcode Intake</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine Batch</span>
            </button>
          </div>
        }
      />

      {/* Predictable AI: Environmental Medicine Demand Engine */}
      <section className="mb-6 rounded-2xl border-2 border-teal-500/20 bg-gradient-to-br from-white via-teal-50/20 to-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-teal-100 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">
                Predictable AI: Environmental Medicine Demand Forecaster
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Predicts required medicine quantities dynamically modeled against weather, AQI, ambient thermal stress, humidity, and outbreak risk.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">XAI Explainer:</span>
            <select
              value={explainerProvider}
              onChange={(e) => setExplainerProvider(e.target.value)}
              className="text-xs bg-white border border-teal-200 rounded-lg px-2.5 py-1.5 font-medium text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="rules">Deterministic Grounded Rules (100% Audited)</option>
              <option value="openai">OpenAI (GPT-4o Engine)</option>
              <option value="anthropic">Claude 3.5 Sonnet (Anthropic)</option>
            </select>
          </div>
        </div>

        {/* Environmental Parameter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Medicine</label>
            <select
              value={forecastMedicineId}
              onChange={(e) => {
                setForecastMedicineId(e.target.value);
                setForecast(null);
              }}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-medium"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.strength})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Horizon Window</label>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-medium"
            >
              <option value={14}>14 Days</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={60}>60 Days (Bi-monthly)</option>
              <option value={90}>90 Days (Quarterly)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CloudSun className="w-3.5 h-3.5 text-amber-500" /> Season
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-medium"
            >
              <option value="monsoon">Monsoon (Vector Surge)</option>
              <option value="winter">Winter (Respiratory/Smog)</option>
              <option value="summer">Summer (Heat/Hydration)</option>
              <option value="post_monsoon">Post-Monsoon (Viral)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <ThermometerSnowflake className="w-3.5 h-3.5 text-rose-500" /> Temp: {temperature}°C
            </label>
            <input
              type="range"
              min={10}
              max={46}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-teal-600 mt-2"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> Humidity: {humidity}%
            </label>
            <input
              type="range"
              min={15}
              max={95}
              value={humidity}
              onChange={(e) => setHumidity(Number(e.target.value))}
              className="w-full accent-teal-600 mt-2"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-slate-600" /> Air Quality (AQI)
            </label>
            <select
              value={aqi}
              onChange={(e) => setAqi(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-medium"
            >
              <option value={75}>AQI 75 (Good)</option>
              <option value={160}>AQI 160 (Moderate)</option>
              <option value={260}>AQI 260 (Very Poor)</option>
              <option value={380}>AQI 380 (Severe Smog)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600">Outbreak Alert Level:</span>
            {['none', 'moderate', 'high', 'critical'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setOutbreakRisk(lvl)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition-colors ${
                  outbreakRisk === lvl
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={runForecast}
            disabled={!forecastMedicineId || forecastLoading}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{forecastLoading ? 'Computing Environmental AI…' : 'Run Predictable AI Simulation'}</span>
          </button>
        </div>

        {/* AI Forecast Result Card */}
        {forecast && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-white p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-100">
                <span className="text-[11px] font-semibold text-teal-800 uppercase block">Recommended Replenishment</span>
                <span className="text-2xl font-black text-teal-900">{forecast.recommended_replenishment}</span>
                <span className="text-[10px] text-teal-700 block mt-0.5">Net units to reorder</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600 uppercase block">Predicted Clinical Demand</span>
                <span className="text-2xl font-bold text-slate-900">{forecast.forecast_quantity}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">With environmental adjustment</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600 uppercase block">Baseline Demand</span>
                <span className="text-2xl font-bold text-slate-700">{forecast.baseline_quantity || '—'}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Unadjusted bed consumption</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600 uppercase block">Current Unexpired Stock</span>
                <span className="text-2xl font-bold text-slate-700">{forecast.current_stock_units}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Available on-site units</span>
              </div>
            </div>

            {/* Environmental Factor Impact Chips */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4 text-teal-600" />
                  Environmental Impact Breakdown (Composite: {forecast.environment.combined_multiplier}x Multiplier):
                </span>
                <span className="text-[11px] font-bold text-teal-700">
                  {forecast.environment.combined_multiplier >= 1 ? '+' : ''}
                  {Math.round((forecast.environment.combined_multiplier - 1) * 100)}% Environmental Shift
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800">Season Factor ({forecast.environment.season_factor}x)</div>
                  <div className="text-slate-500 text-[10px]">{forecast.environment.season_reason}</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800">Air Quality AQI ({forecast.environment.aqi_factor}x)</div>
                  <div className="text-slate-500 text-[10px]">{forecast.environment.aqi_reason}</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800">Temperature & Humidity ({forecast.environment.temperature_factor}x / {forecast.environment.humidity_factor}x)</div>
                  <div className="text-slate-500 text-[10px]">{forecast.environment.temperature_reason}</div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800">Outbreak Multiplier ({forecast.environment.outbreak_factor}x)</div>
                  <div className="text-slate-500 text-[10px]">{forecast.environment.outbreak_reason}</div>
                </div>
              </div>
            </div>

            {/* Explainable AI (XAI) Synthesis */}
            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <span>Explainable AI (XAI) Clinical Justification — {forecast.explainable_ai.provider.toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                  100% Verified DB Grounded
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                {forecast.explainable_ai.explanation}
              </p>

              {/* Toggle 100% Grounding Audit Table */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowXaiAudit(!showXaiAudit)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 hover:text-teal-900 underline"
                >
                  {showXaiAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showXaiAudit ? 'Hide' : 'Inspect'} 100% Mathematical Grounding Audit ({forecast.explainable_ai.grounding_audit?.length || 0} DB metrics)</span>
                </button>

                {showXaiAudit && forecast.explainable_ai.grounding_audit && (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-teal-200 bg-white">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-teal-100/60 text-teal-900 font-bold border-b border-teal-200">
                        <tr>
                          <th className="px-3 py-1.5">Database Metric / Parameter</th>
                          <th className="px-3 py-1.5">Audited Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {forecast.explainable_ai.grounding_audit.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-medium text-slate-700">{item.metric}</td>
                            <td className="px-3 py-1.5 font-mono text-teal-800">{item.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <details className="mt-4 border-t border-teal-100 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-teal-800">
            Log Recorded In-Hospital Demand Event
          </summary>
          <form onSubmit={recordDemand} className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-[11px] font-semibold text-slate-600">
              Requested Units
              <input
                type="number"
                min={1}
                value={demandQuantity}
                onChange={(event) => setDemandQuantity(Number(event.target.value))}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Observed Date
              <input
                type="date"
                value={demandDate}
                onChange={(event) => setDemandDate(event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Priority
              <select
                value={demandPriority}
                onChange={(event) => setDemandPriority(event.target.value as typeof demandPriority)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button
              type="submit"
              className="self-end rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              Save Demand Record
            </button>
          </form>
        </details>
      </section>

      {/* Batch Inventory Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search batches by lot number or medicine..."
          className="w-full sm:w-80"
        />
      </div>

      <DataTable
        columns={columns}
        data={batches}
        keyExtractor={(b) => b.id}
        loading={loading}
      />

      {/* Add / Edit Batch Modal with Barcode Scanner Integration */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBatch ? 'Modify Batch Registry' : 'Inward Batch Registration'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Barcode Scanner Section for Batch Entry */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-teal-900">
              Scan Medicine Barcode (Auto-Selects Catalog Drug)
            </label>
            <div className="flex gap-2">
              <input
                value={barcodeLookup}
                onChange={(event) => setBarcodeLookup(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    lookupMedicineBarcode(barcodeLookup);
                  }
                }}
                type="text"
                placeholder="Scan or enter barcode (e.g. 8901234567890)"
                className="min-w-0 flex-1 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => lookupMedicineBarcode(barcodeLookup)}
                className="px-3 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-2xs"
              >
                Match
              </button>
            </div>

            <BarcodeScanner
              label="Open Camera Scanner"
              onDetected={lookupMedicineBarcode}
              showDemoChips={true}
            />

            {selectedMedicineName && (
              <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-1 rounded flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Selected: {selectedMedicineName}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Medicine *
            </label>
            <select
              {...register('medicine_id')}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.generic_name}) - {m.strength}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batch / Lot # *
              </label>
              <input
                type="text"
                {...register('batch_number')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
              {errors.batch_number && (
                <p className="text-xs text-red-500 mt-1">{errors.batch_number.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Units in Stock *
              </label>
              <input
                type="number"
                {...register('quantity', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manufacturing Date *
              </label>
              <input
                type="date"
                {...register('manufacturing_date')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                {...register('expiry_date')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Purchase Cost (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('unit_purchase_cost', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit MRP / Selling Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('unit_price', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Storage Condition Protocol
            </label>
            <input
              type="text"
              {...register('storage_condition')}
              placeholder="e.g. Cold Chain (2°C - 8°C)"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
            >
              {editingBatch ? 'Save Changes' : 'Register Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Discard Pharmaceutical Batch?"
        message={`Are you sure you want to delete Lot #${batchToDelete?.batch_number}? This will permanently remove it from local pharmacy inventory surveillance.`}
        variant="danger"
        confirmText="Confirm Delete"
      />

      {/* Quick Direct Barcode Intake Modal */}
      <QuickBarcodeAddModal
        isOpen={quickScanModalOpen}
        onClose={() => setQuickScanModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </AnimatedPage>
  );
};

export default MedicineBatchesPage;
