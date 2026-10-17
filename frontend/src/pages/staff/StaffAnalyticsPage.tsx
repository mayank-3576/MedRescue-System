import React, { useState } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Download, Calendar } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import ExpiryDistributionChart from '../../components/charts/ExpiryDistributionChart';
import RiskTrendChart from '../../components/charts/RiskTrendChart';
import TransferStatusChart from '../../components/charts/TransferStatusChart';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export const StaffAnalyticsPage: React.FC = () => {
  const { user } = useAuth();

  const hospitalExpiryData = [
    { name: 'Critical (< 30d)', value: 4, color: '#EF4444' },
    { name: 'High (30 - 60d)', value: 7, color: '#F97316' },
    { name: 'Medium (60 - 90d)', value: 12, color: '#F59E0B' },
    { name: 'Safe (> 90d)', value: 48, color: '#10B981' },
  ];

  const hospitalTrendsData = [
    { month: 'Jun', saved_value: 45000, expired_value: 12000 },
    { month: 'Jul', saved_value: 78000, expired_value: 9500 },
    { month: 'Aug', saved_value: 125000, expired_value: 6000 },
    { month: 'Sep', saved_value: 210000, expired_value: 4200 },
    { month: 'Oct', saved_value: 320000, expired_value: 2800 },
  ];

  const hospitalTransfersData = [
    { status: 'Delivered', count: 14 },
    { status: 'In Transit', count: 3 },
    { status: 'Pending Approval', count: 1 },
  ];

  const handleExport = () => {
    toast.success('Facility Pharmacy Waste Audit exported as CSV');
  };

  return (
    <AnimatedPage>
      <PageHeader
        title="Hospital Redistribution Analytics"
        subtitle={`Audit of inventory turnover, waste reduction, and inter-facility transfers for ${user?.hospital_name || 'Hospital'}.`}
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export Facility Report</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card
          title="Prevented Medicine Loss"
          subtitle="Monthly monetary value rescued through redistribution"
        >
          <RiskTrendChart data={hospitalTrendsData} height={270} />
        </Card>

        <Card
          title="Facility Expiry Risk Horizon"
          subtitle="Proportion of active stock categorized by shelf-life urgency"
        >
          <ExpiryDistributionChart data={hospitalExpiryData} height={270} />
        </Card>
      </div>

      <Card
        title="Facility Consignment Completion Status"
        subtitle="Inbound and outbound fulfillment rates"
      >
        <TransferStatusChart data={hospitalTransfersData} height={230} />
      </Card>
    </AnimatedPage>
  );
};

export default StaffAnalyticsPage;
