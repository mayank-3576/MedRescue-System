import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { Column } from '../../components/common/DataTable';
import FilterDropdown from '../../components/common/FilterDropdown';
import Badge from '../../components/common/Badge';
import { alertsApi } from '../../api/alerts';
import { useAuth } from '../../hooks/useAuth';
import { ExpiryAlert, RiskLevel } from '../../types';
import toast from 'react-hot-toast';

export const StaffExpiryAlerts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('all');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await alertsApi.getAll({
        hospital_id: hospitalId,
        risk_level: riskFilter !== 'all' ? (riskFilter as RiskLevel) : undefined,
      });
      setAlerts(data);
    } catch (e) {
      toast.error('Failed to load facility alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [riskFilter, hospitalId]);

  const columns: Column<ExpiryAlert>[] = [
    {
      key: 'medicine',
      header: 'Drug & Batch',
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">
            {a.medicine_name}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Lot #{a.batch_number} • {a.batch_quantity} units
          </span>
        </div>
      ),
    },
    {
      key: 'risk_level',
      header: 'Risk Horizon',
      render: (a) => (
        <Badge variant={a.risk_level} size="sm" pulse={a.risk_level === 'critical'}>
          {a.risk_level.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'days_left',
      header: 'Time to Expiry',
      sortable: true,
      render: (a) => (
        <span className="text-xs font-bold text-slate-800">{a.days_left} Days</span>
      ),
    },
    {
      key: 'estimated_waste_cost',
      header: 'Value at Risk',
      sortable: true,
      render: (a) => (
        <span className="text-xs font-bold text-red-600">
          ₹{a.estimated_waste_cost.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (a) => (
        <button
          type="button"
          onClick={() => navigate('/staff/rescue')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors shadow-2xs"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Redistribute Surplus</span>
        </button>
      ),
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        title="Hospital Expiry Risk Surveillance"
        subtitle={`Critical alert monitoring for pharmacy inventory held at ${user?.hospital_name || 'Hospital'}.`}
        actions={
          <button
            type="button"
            onClick={() => navigate('/staff/rescue')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>AI Rescue Matching</span>
          </button>
        }
      />

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs mb-4 flex items-center justify-between">
        <FilterDropdown
          label="Risk Horizon"
          value={riskFilter}
          onChange={setRiskFilter}
          options={[
            { label: 'All Alerts', value: 'all' },
            { label: 'Critical (< 30d)', value: 'critical' },
            { label: 'High (30 - 60d)', value: 'high' },
            { label: 'Medium (60 - 90d)', value: 'medium' },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={alerts}
        keyExtractor={(a) => a.id}
        loading={loading}
      />
    </AnimatedPage>
  );
};

export default StaffExpiryAlerts;
