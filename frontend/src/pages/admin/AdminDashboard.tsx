import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  Building2,
  Package,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  ArrowLeftRight,
  Zap,
  DollarSign,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import DashboardHero from '../../components/common/DashboardHero';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import InventoryChart from '../../components/charts/InventoryChart';
import ExpiryDistributionChart from '../../components/charts/ExpiryDistributionChart';
import RiskTrendChart from '../../components/charts/RiskTrendChart';
import { dashboardApi } from '../../api/dashboard';
import { analyticsApi } from '../../api/analytics';
import { alertsApi } from '../../api/alerts';
import { DashboardStats, AnalyticsData, ExpiryAlert } from '../../types';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (stats) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsData, analyticsData, alertsData] = await Promise.all([
        dashboardApi.getAdminStats(),
        analyticsApi.getAnalyticsData(),
        alertsApi.getAll({ risk_level: 'critical', is_resolved: false }),
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
      setCriticalAlerts(alertsData.slice(0, 5));
    } catch (error) {
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !stats || !analytics) {
    return (
      <AnimatedPage>
        <LoadingSkeleton type="stat" className="mb-6" />
        <LoadingSkeleton type="card" rows={3} />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <DashboardHero
        eyebrow="National command · network overview"
        title={`${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, ${user?.full_name?.split(' ')[0] || 'Admin'}`}
        subtitle="A clear view of medicine availability, expiry risk, and rescue activity across the hospital network."
        icon={Activity}
        stats={[
          { label: 'Connected hospitals', value: stats.total_hospitals, note: 'Network facilities' },
          { label: 'Critical alerts', value: stats.critical_alerts, note: 'Needs attention' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.15] disabled:opacity-60"
              title="Refresh dashboard data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/rescue')}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-teal-800 shadow-lg shadow-slate-950/10 transition-all hover:-translate-y-0.5 hover:bg-teal-50"
            >
              <Zap className="w-4 h-4" />
              <span>Start medicine rescue</span>
            </button>
          </div>
        }
      />

      {/* 6 Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Connected Hospitals"
          value={stats.total_hospitals}
          icon={Building2}
          color="teal"
          subtitle="Delhi NCR Node"
          onClick={() => navigate('/admin/hospitals')}
          delay={0.06}
        />
        <StatCard
          title="Active Batches"
          value={stats.active_batches}
          icon={Package}
          color="blue"
          subtitle="Platform-wide"
          onClick={() => navigate('/admin/inventory')}
          delay={0.12}
        />
        <StatCard
          title="Critical Alerts"
          value={stats.critical_alerts}
          icon={AlertTriangle}
          color="rose"
          subtitle="< 30 days expiry"
          trend={{ value: 'Urgent', isPositive: false }}
          onClick={() => navigate('/admin/alerts')}
          delay={0.18}
        />
        <StatCard
          title="Value At Risk"
          value={stats.total_value_at_risk}
          icon={DollarSign}
          prefix="₹"
          color="amber"
          subtitle="Expiring stock"
          onClick={() => navigate('/admin/alerts')}
          delay={0.24}
        />
        <StatCard
          title="Rescued Value"
          value={stats.saved_value}
          icon={TrendingUp}
          prefix="₹"
          color="emerald"
          trend={{ value: '+24%', isPositive: true, label: 'vs last mo' }}
          onClick={() => navigate('/admin/analytics')}
          delay={0.3}
        />
        <StatCard
          title="Pending Transfers"
          value={stats.pending_transfers}
          icon={ArrowLeftRight}
          color="blue"
          subtitle="Awaiting dispatch"
          onClick={() => navigate('/admin/transfers')}
          delay={0.36}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Inventory distribution across facilities */}
        <Card
          title="Regional Inventory Valuation"
          subtitle="Total medicine stock valuation across networked healthcare nodes"
          className="lg:col-span-2"
          hover
          action={
            <button
              type="button"
              onClick={() => navigate('/admin/inventory')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
          delay={0.17}
        >
          <InventoryChart data={analytics.inventory_by_hospital} mode="value" height={280} />
        </Card>

        {/* Expiry Risk Breakdown */}
        <Card
          title="Batch Expiry Risk Profile"
          subtitle="Distribution of stock by time-to-expiry horizon"
          hover
          action={
            <button
              type="button"
              onClick={() => navigate('/admin/alerts')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>Alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
          delay={0.17}
        >
          <ExpiryDistributionChart data={analytics.expiry_risk_distribution} height={280} />
        </Card>
      </div>

      {/* Redistribution Financial Impact & Urgent Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saved vs Expired Trends */}
        <Card
          title="Rescue Performance & Waste Prevention"
          subtitle="Monthly financial savings achieved through autonomous redistribution"
          className="lg:col-span-2"
          hover
          delay={0.1}
        >
          <RiskTrendChart data={analytics.monthly_trends} height={260} />
        </Card>

        {/* Urgent Action Batches */}
        <Card
          title="Immediate Attention Required"
          subtitle="Batches with highest risk of imminent expiration"
          hover
          action={
            <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              {criticalAlerts.length > 0 && <motion.span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" animate={reducedMotion ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />}
              {criticalAlerts.length} Critical
            </span>
          }
          delay={0.17}
        >
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {criticalAlerts.length === 0 ? <div className="flex flex-col items-center py-8 text-center"><ShieldCheck className="h-9 w-9 text-emerald-500" /><p className="mt-2 text-sm font-semibold text-slate-700">No critical alerts</p><p className="mt-1 text-xs text-slate-500">The network has no urgent expiry cases.</p></div> : criticalAlerts.map((alert, index) => (
              <motion.div key={alert.id} initial={reducedMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06, duration: 0.28 }} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {alert.batch?.medicine?.name || 'Medicinal Compound'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {alert.hospital?.name || 'Facility'} • {alert.batch?.quantity || 0} units
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="critical" size="sm">
                      {alert.days_left}d left
                    </Badge>
                    <span className="text-[11px] font-bold text-red-600">
                      ₹{alert.estimated_waste_cost.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/rescue')}
                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold rounded-lg transition-colors shrink-0"
                >
                  Rescue
                </button>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default AdminDashboard;
