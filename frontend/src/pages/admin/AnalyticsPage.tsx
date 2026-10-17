import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import InventoryChart from '../../components/charts/InventoryChart';
import ExpiryDistributionChart from '../../components/charts/ExpiryDistributionChart';
import TransferStatusChart from '../../components/charts/TransferStatusChart';
import { analyticsApi } from '../../api/analytics';
import { AnalyticsData } from '../../types';
import toast from 'react-hot-toast';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await analyticsApi.getAnalyticsData();
      setData(result);
    } catch (e) {
      toast.error('Failed to load analytics metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCsv = async (type: 'inventory' | 'transfers' | 'alerts') => {
    setExporting(true);
    try {
      const blob = await analyticsApi.exportCsv(type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medrescue_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${type.toUpperCase()} CSV report downloaded`);
    } catch (e) {
      toast.error('Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !data) {
    return (
      <AnimatedPage>
        <LoadingSkeleton type="card" rows={3} />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Predictive Analytics & Network Intelligence"
        subtitle="Deep audit of waste prevention efficacy, redistribution throughput, and capital optimization across participating healthcare systems."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportCsv('inventory')}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      <Card title="Historical trend reporting" subtitle="Trend history requires periodic inventory snapshots, which are not recorded in this deployment.">
        <p className="py-4 text-sm text-slate-600">The metrics below show current database state. Historical savings and value at risk trends are unavailable until snapshot collection is enabled.</p>
      </Card>

      {/* Row 2: Facility Inventory Breakdown and Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card
          title="Medicine Stock Valuation by Hospital"
          subtitle="Total asset value held in active clinical pharmacies"
          className="lg:col-span-2"
        >
          <InventoryChart data={data.inventory_by_hospital} mode="value" height={280} />
        </Card>

        <Card
          title="Batch Risk Classification"
          subtitle="Shelf-life vulnerability across all regional lots"
        >
          <ExpiryDistributionChart data={data.expiry_risk_distribution} height={280} />
        </Card>
      </div>

      {/* Row 3: Transfer Deliveries Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Redistribution Fulfillment by Status"
          subtitle="Realized delivery completion rate for inter-facility consignments"
        >
          <TransferStatusChart data={data.transfers_by_status} height={240} />
        </Card>

        <Card
          title="Export Regulatory Reports"
          subtitle="Generate standardized data exports for hospital pharmacy audits and compliance"
        >
          <div className="space-y-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Hospital Inventory & Batch Registry</p>
                <p className="text-[11px] text-slate-500">Comprehensive SKU catalog, lots, and shelf-life metrics</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv('inventory')}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Download CSV
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Inter-Facility Logistics Log</p>
                <p className="text-[11px] text-slate-500">Chain of custody, delivery costs, and transit times</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv('transfers')}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Download CSV
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Expiry Risk Warning Audit</p>
                <p className="text-[11px] text-slate-500">All triggered alerts, resolution logs, and prevented loss figures</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportCsv('alerts')}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Download CSV
              </button>
            </div>
          </div>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default AnalyticsPage;
