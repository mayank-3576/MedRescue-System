import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  Plus,
  Search,
  ThermometerSnowflake,
  AlertTriangle,
  Building,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import { medicinesApi } from '../../api/medicines';
import { batchesApi } from '../../api/batches';
import { hospitalsApi } from '../../api/hospitals';
import { Medicine, MedicineBatch, Hospital } from '../../types';
import toast from 'react-hot-toast';
import BarcodeScanner from '../../components/common/BarcodeScanner';

const medicineSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  generic_name: z.string().min(2, 'Generic chemical name required'),
  category: z.string().min(2, 'Category required'),
  dosage_form: z.string().min(1, 'Dosage form required'),
  strength: z.string().min(1, 'Strength required'),
  manufacturer: z.string().min(2, 'Manufacturer required'),
  barcode: z.string().optional(),
  unit_price: z.number().min(0.1, 'Price must be greater than zero'),
  min_stock_level: z.number().min(1, 'Min stock required'),
  requires_cold_chain: z.boolean(),
  description: z.string().optional(),
});

type MedicineFormData = z.infer<typeof medicineSchema>;

export const AdminInventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'catalog'>('batches');
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const [medicineModalOpen, setMedicineModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema),
    defaultValues: {
      requires_cold_chain: false,
      unit_price: 500,
      min_stock_level: 50,
      category: 'Antibiotic',
    },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, medData, hospData] = await Promise.all([
        batchesApi.getAll({
          search: search || undefined,
          hospital_id: hospitalFilter !== 'all' ? hospitalFilter : undefined,
          risk_level: riskFilter !== 'all' ? riskFilter : undefined,
        }),
        medicinesApi.getAll({ search: search || undefined }),
        hospitalsApi.getAll({ is_active: true }),
      ]);
      setBatches(batchData);
      setMedicines(medData);
      setHospitals(hospData);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, hospitalFilter, riskFilter]);

  const onAddMedicine = async (data: MedicineFormData) => {
    try {
      await medicinesApi.create(data);
      toast.success('New medicine added to platform master catalog');
      setMedicineModalOpen(false);
      reset();
      loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to create medicine entry';
      toast.error(msg);
    }
  };

  const batchColumns: Column<MedicineBatch>[] = [
    {
      key: 'batch_number',
      header: 'Batch #',
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-mono font-bold text-slate-800 block text-xs">{b.batch_number}</span>
          <span className="text-[11px] text-slate-400">Mfg: {b.manufacturing_date}</span>
        </div>
      ),
    },
    {
      key: 'medicine',
      header: 'Medicine & Formulation',
      render: (b) => (
        <div>
          <span className="font-semibold text-slate-900 block">{b.medicine?.name}</span>
          <span className="text-xs text-slate-500">
            {b.medicine?.generic_name} • {b.medicine?.strength}
          </span>
        </div>
      ),
    },
    {
      key: 'hospital',
      header: 'Facility Node',
      render: (b) => (
        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          {b.hospital?.name || 'Central Stock'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Stock Units',
      sortable: true,
      render: (b) => (
        <span className="font-semibold text-slate-900">{b.quantity.toLocaleString()}</span>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      sortable: true,
      render: (b) => (
        <div>
          <span className="text-xs font-semibold text-slate-800 block">{b.expiry_date}</span>
          <span className="text-[11px] text-slate-500">{b.days_to_expiry} days remaining</span>
        </div>
      ),
    },
    {
      key: 'risk_level',
      header: 'Risk Level',
      sortable: true,
      render: (b) => (
        <Badge variant={b.risk_level || 'low'} size="sm">
          {(b.risk_level || 'LOW').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'value_at_risk',
      header: 'Valuation',
      sortable: true,
      render: (b) => (
        <span className="text-xs font-bold text-slate-900">
          ₹{(b.quantity * b.unit_price).toLocaleString()}
        </span>
      ),
    },
  ];

  const catalogColumns: Column<Medicine>[] = [
    {
      key: 'name',
      header: 'Medicine Name',
      sortable: true,
      render: (m) => (
        <div>
          <span className="font-semibold text-slate-900 block">{m.name}</span>
          <span className="text-xs text-slate-500">{m.generic_name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (m) => (
        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
          {m.category}
        </span>
      ),
    },
    {
      key: 'dosage_form',
      header: 'Dosage / Strength',
      render: (m) => (
        <span className="text-xs text-slate-600">
          {m.dosage_form} • {m.strength}
        </span>
      ),
    },
    {
      key: 'manufacturer',
      header: 'Manufacturer',
      sortable: true,
    },
    {
      key: 'unit_price',
      header: 'Price / Unit',
      sortable: true,
      render: (m) => <span className="font-semibold text-slate-800">₹{m.unit_price}</span>,
    },
    {
      key: 'requires_cold_chain',
      header: 'Cold Chain',
      render: (m) =>
        m.requires_cold_chain ? (
          <span className="inline-flex items-center gap-1 text-xs text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
            <ThermometerSnowflake className="w-3 h-3" />
            2°C - 8°C
          </span>
        ) : (
          <span className="text-xs text-slate-500">Standard</span>
        ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Platform Medicine Inventory"
        subtitle="Live catalog of registered pharmaceutical batches, stock reserves, and storage parameters across the redistribution node."
        actions={
          <button
            type="button"
            onClick={() => setMedicineModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Catalog Medicine</span>
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active Facility Batches ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Master Drug Catalog ({medicines.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by drug name, active ingredient, or batch..."
          className="w-full sm:w-72"
        />

        {activeTab === 'batches' && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <FilterDropdown
              label="Facility"
              value={hospitalFilter}
              onChange={setHospitalFilter}
              options={[
                { label: 'All Facilities', value: 'all' },
                ...hospitals.map((h) => ({ label: h.name, value: h.id })),
              ]}
            />
            <FilterDropdown
              label="Risk"
              value={riskFilter}
              onChange={setRiskFilter}
              options={[
                { label: 'All Risk Horizons', value: 'all' },
                { label: 'Critical (< 30d)', value: 'critical' },
                { label: 'High (30 - 60d)', value: 'high' },
                { label: 'Medium (60 - 90d)', value: 'medium' },
                { label: 'Low (> 90d)', value: 'low' },
              ]}
            />
          </div>
        )}
      </div>

      {activeTab === 'batches' ? (
        <DataTable
          columns={batchColumns}
          data={batches}
          keyExtractor={(b) => b.id}
          loading={loading}
        />
      ) : (
        <DataTable
          columns={catalogColumns}
          data={medicines}
          keyExtractor={(m) => m.id}
          loading={loading}
        />
      )}

      {/* Add Master Medicine Modal */}
      <Modal
        isOpen={medicineModalOpen}
        onClose={() => setMedicineModalOpen(false)}
        title="Add Drug Formulation to Master Catalog"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onAddMedicine)} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Medicine barcode</label>
            <div className="flex gap-2">
              <input type="text" {...register('barcode')} placeholder="Scan or enter GTIN / barcode" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <BarcodeScanner label="Scan" onDetected={(value) => setValue('barcode', value, { shouldValidate: true, shouldDirty: true })} />
            </div>
            <p className="text-[11px] text-slate-500">A barcode must be unique across the medicine catalog.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Commercial Brand Name *
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. Meropenem 1g Injection"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Generic Salt / Molecule *
              </label>
              <input
                type="text"
                {...register('generic_name')}
                placeholder="e.g. Meropenem Trihydrate"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <input
                type="text"
                {...register('category')}
                placeholder="e.g. Antibiotic"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dosage Form *
              </label>
              <input
                type="text"
                {...register('dosage_form')}
                placeholder="e.g. Vial, Syringe, Tablet"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Strength *
              </label>
              <input
                type="text"
                {...register('strength')}
                placeholder="e.g. 1g, 40mg/0.4ml"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Manufacturer *
              </label>
              <input
                type="text"
                {...register('manufacturer')}
                placeholder="e.g. Sun Pharma, Cipla"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('unit_price', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Stock Level *
              </label>
              <input
                type="number"
                {...register('min_stock_level', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="cold_chain_check"
              {...register('requires_cold_chain')}
              className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
            />
            <label htmlFor="cold_chain_check" className="text-xs font-medium text-slate-700">
              Requires Cold Chain Temperature Monitoring (2°C – 8°C)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMedicineModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
            >
              Register Medicine
            </button>
          </div>
        </form>
      </Modal>
    </AnimatedPage>
  );
};

export default AdminInventoryPage;
