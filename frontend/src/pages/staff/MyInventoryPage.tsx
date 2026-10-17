import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, ThermometerSnowflake, AlertTriangle, ShieldCheck, Barcode } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Badge from '../../components/common/Badge';
import QuickBarcodeAddModal from '../../components/common/QuickBarcodeAddModal';
import { medicinesApi } from '../../api/medicines';
import { batchesApi } from '../../api/batches';
import { useAuth } from '../../hooks/useAuth';
import { Medicine, MedicineBatch } from '../../types';
import toast from 'react-hot-toast';

export const MyInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await batchesApi.getAll({
        hospital_id: hospitalId,
        search: search || undefined,
        risk_level: riskFilter !== 'all' ? riskFilter : undefined,
      });
      setBatches(data);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [search, riskFilter, hospitalId]);

  const columns: Column<MedicineBatch>[] = [
    {
      key: 'medicine',
      header: 'Drug Name & Strength',
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">{b.medicine?.name}</span>
          <span className="text-[11px] text-slate-500">
            {b.medicine?.generic_name} • {b.medicine?.dosage_form}
          </span>
        </div>
      ),
    },
    {
      key: 'batch_number',
      header: 'Lot / Batch #',
      render: (b) => <span className="font-mono text-xs font-semibold text-slate-800">{b.batch_number}</span>,
    },
    {
      key: 'quantity',
      header: 'Current Stock',
      sortable: true,
      render: (b) => (
        <span className="font-bold text-slate-900 text-xs">{b.quantity.toLocaleString()} units</span>
      ),
    },
    {
      key: 'storage_condition',
      header: 'Storage Specs',
      render: (b) => (
        <span className="text-xs text-slate-600 flex items-center gap-1">
          {b.medicine?.requires_cold_chain ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              <ThermometerSnowflake className="w-3 h-3" />
              2°C - 8°C
            </span>
          ) : (
            <span>Room Temp (&lt; 25°C)</span>
          )}
        </span>
      ),
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">{b.expiry_date}</span>
          <span className="text-[11px] text-slate-400">{b.days_to_expiry} days remaining</span>
        </div>
      ),
    },
    {
      key: 'risk_level',
      header: 'Expiry Risk',
      sortable: true,
      render: (b) => (
        <Badge variant={b.risk_level || 'low'} size="sm">
          {(b.risk_level || 'LOW').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (b) => (
        <button
          type="button"
          onClick={() => navigate('/staff/rescue')}
          className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200/50"
        >
          Redistribute
        </button>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Hospital Medicine Inventory"
        subtitle={`Current active stocks and formulations stored at ${user?.hospital_name || 'Facility Pharmacy'}.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBarcodeModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              <Barcode className="w-4 h-4 text-teal-400" />
              <span>Quick Barcode Scan & Add</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff/batches')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Register Inward Batch</span>
            </button>
          </div>
        }
      />

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by drug name or lot number..."
          className="w-full sm:w-72"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <FilterDropdown
            label="Risk Horizon"
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { label: 'All Lots', value: 'all' },
              { label: 'Critical (< 30d)', value: 'critical' },
              { label: 'High (30 - 60d)', value: 'high' },
              { label: 'Safe (> 90d)', value: 'low' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={batches}
        keyExtractor={(b) => b.id}
        loading={loading}
      />

      <QuickBarcodeAddModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        onSuccess={() => loadBatches()}
      />
    </AnimatedPage>
  );
};

export default MyInventoryPage;
