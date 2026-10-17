import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Zap,
  Building,
  Calendar,
  CheckCircle2,
  DollarSign,
  Search,
  Filter,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import { alertsApi } from '../../api/alerts';
import { hospitalsApi } from '../../api/hospitals';
import { ExpiryAlert, Hospital, RiskLevel } from '../../types';
import toast from 'react-hot-toast';

export const AdminExpiryAlerts: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('unresolved');

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ExpiryAlert | null>(null);
  const [resolveReason, setResolveReason] = useState('Redistributed to recipient hospital via MedRescue System');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const [alertsData, hospData] = await Promise.all([
        alertsApi.getAll({
          risk_level: riskFilter !== 'all' ? (riskFilter as RiskLevel) : undefined,
          hospital_id: hospitalFilter !== 'all' ? hospitalFilter : undefined,
          is_resolved: resolvedFilter === 'resolved' ? true : resolvedFilter === 'unresolved' ? false : undefined,
        }),
        hospitalsApi.getAll(),
      ]);
      setAlerts(alertsData);
      setHospitals(hospData);
    } catch (e) {
      toast.error('Failed to load expiry alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [riskFilter, hospitalFilter, resolvedFilter]);

  const handleOpenResolve = (alert: ExpiryAlert) => {
    setSelectedAlert(alert);
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async () => {
    if (!selectedAlert) return;
    try {
      await alertsApi.resolveAlert(selectedAlert.id, resolveReason);
      toast.success('Alert marked as resolved');
      setResolveModalOpen(false);
      setSelectedAlert(null);
      loadAlerts();
    } catch (e) {
      toast.error('Failed to resolve alert');
    }
  };

  const columns: Column<ExpiryAlert>[] = [
    {
      key: 'medicine',
      header: 'Medicine & Batch',
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-900 block">
            {a.medicine_name || 'Medical Supply'}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Batch #{a.batch_number || 'N/A'} • {a.batch_quantity || 0} units
          </span>
        </div>
      ),
    },
    {
      key: 'hospital',
      header: 'Holding Facility',
      render: (a) => (
        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          {a.hospital_name}
        </span>
      ),
    },
    {
      key: 'risk_level',
      header: 'Risk Classification',
      render: (a) => (
        <Badge variant={a.risk_level} size="sm" pulse={a.risk_level === 'critical'}>
          {a.risk_level.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'days_left',
      header: 'Expiry Horizon',
      sortable: true,
      render: (a) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">{a.days_left} Days</span>
          <span className="text-[10px] text-slate-400">Date: {a.expiry_date}</span>
        </div>
      ),
    },
    {
      key: 'estimated_waste_cost',
      header: 'Value at Risk',
      sortable: true,
      render: (a) => (
        <span className="font-bold text-red-600 text-xs">
          ₹{a.estimated_waste_cost.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) =>
        a.is_resolved ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Resolved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Unresolved
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Rescue Actions',
      render: (a) => (
        <div className="flex items-center gap-2">
          {!a.is_resolved ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/admin/rescue')}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
              >
                <Zap className="w-3 h-3" />
                <span>Rescue</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenResolve(a)}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
              >
                Dismiss
              </button>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Resolved</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Expiry Risk Warnings & Alerts"
        subtitle="Algorithmic risk detection tracking shelf-life trajectories to prevent pharmaceutical expiration."
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/rescue')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Launch Redistribution Engine</span>
          </button>
        }
      />

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterDropdown
            label="Risk Level"
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { label: 'All Severities', value: 'all' },
              { label: 'Critical (< 30d)', value: 'critical' },
              { label: 'High (30 - 60d)', value: 'high' },
              { label: 'Medium (60 - 90d)', value: 'medium' },
            ]}
          />
          <FilterDropdown
            label="Holding Facility"
            value={hospitalFilter}
            onChange={setHospitalFilter}
            options={[
              { label: 'All Facilities', value: 'all' },
              ...hospitals.map((h) => ({ label: h.name, value: h.id })),
            ]}
          />
          <FilterDropdown
            label="Status"
            value={resolvedFilter}
            onChange={setResolvedFilter}
            options={[
              { label: 'Actionable (Unresolved)', value: 'unresolved' },
              { label: 'Resolved / Redistributed', value: 'resolved' },
              { label: 'All Alerts', value: 'all' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={alerts}
        keyExtractor={(a) => a.id}
        loading={loading}
      />

      {/* Resolve Alert Modal */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Expiry Risk Alert"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Confirm manual resolution for{' '}
            <strong className="text-slate-900">{selectedAlert?.medicine_name}</strong> at{' '}
            {selectedAlert?.hospital_name}.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resolution Reason / Outcome
            </label>
            <textarea
              rows={3}
              value={resolveReason}
              onChange={(e) => setResolveReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. Stock utilized in clinical wards / transferred"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmResolve}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
            >
              Confirm Resolution
            </button>
          </div>
        </div>
      </Modal>
    </AnimatedPage>
  );
};

export default AdminExpiryAlerts;
