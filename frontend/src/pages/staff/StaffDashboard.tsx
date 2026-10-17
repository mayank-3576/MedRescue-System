import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  Package,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Bot,
  Plus,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import DashboardHero from '../../components/common/DashboardHero';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ExpiryDistributionChart from '../../components/charts/ExpiryDistributionChart';
import RiskTrendChart from '../../components/charts/RiskTrendChart';
import { useAuth } from '../../hooks/useAuth';
import { dashboardApi } from '../../api/dashboard';
import { batchesApi } from '../../api/batches';
import { DashboardStats, MedicineBatch } from '../../types';
import toast from 'react-hot-toast';

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [criticalBatches, setCriticalBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStaffData = async () => {
      setLoading(true);
      try {
        const [statsData, batchesData] = await Promise.all([
          dashboardApi.getStaffStats(hospitalId),
          batchesApi.getAll({ hospital_id: hospitalId, risk_level: 'critical' }),
        ]);
        setStats(statsData);
        setCriticalBatches(batchesData.slice(0, 4));
      } catch (e) {
        toast.error('Failed to load facility dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadStaffData();
  }, [hospitalId]);

  if (loading || !stats) {
    return (
      <AnimatedPage>
        <LoadingSkeleton type="stat" className="mb-6" />
        <LoadingSkeleton type="card" rows={2} />
      </AnimatedPage>
    );
  }

  const sampleStaffDistribution = [
    { name: 'Critical (< 30d)', value: stats.critical_alerts, color: '#EF4444' },
    { name: 'High (30 - 60d)', value: stats.high_risk_alerts, color: '#F97316' },
    { name: 'Medium (60 - 90d)', value: 8, color: '#F59E0B' },
    { name: 'Safe (> 90d)', value: 24, color: '#10B981' },
  ];

  const sampleStaffTrends = [
    { month: 'Jul', saved_value: 65000, expired_value: 12000 },
    { month: 'Aug', saved_value: 110000, expired_value: 9000 },
    { month: 'Sep', saved_value: 195000, expired_value: 5000 },
    { month: 'Oct', saved_value: 320000, expired_value: 2800 },
  ];

  return (
    <AnimatedPage>
      <DashboardHero
        eyebrow="Hospital workspace · facility overview"
        title={`${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, ${user?.full_name?.split(' ')[0] || 'there'}`}
        subtitle={`${user?.hospital_name || 'Your hospital'} · Review stock health, act on expiry risks, and find medicines available to your facility.`}
        icon={Activity}
        stats={[
          { label: 'Active medicine batches', value: stats.active_batches, note: 'Facility inventory' },
          { label: 'Critical expiry alerts', value: stats.critical_alerts, note: 'Needs attention' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-teal-800 shadow-lg shadow-slate-950/10 transition-all hover:-translate-y-0.5 hover:bg-teal-50"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Browse medicines</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff/batches')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.15]"
            >
              <Plus className="w-4 h-4 text-teal-200" />
              <span>Add stock</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff/assistant')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.15]"
            >
              <Bot className="w-4 h-4 text-teal-200" />
              <span>Ask AI Assistant</span>
            </button>
          </div>
        }
      />

      {/* Facility KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Batches"
          value={stats.active_batches}
          icon={Package}
          color="teal"
          subtitle="Hospital Formulary"
          onClick={() => navigate('/staff/inventory')}
          delay={0.08}
        />
        <StatCard
          title="Critical Alerts"
          value={stats.critical_alerts}
          icon={AlertTriangle}
          color="rose"
          subtitle="Immediate Action"
          trend={{ value: 'Urgent', isPositive: false }}
          onClick={() => navigate('/staff/alerts')}
          delay={0.15}
        />
        <StatCard
          title="Value at Expiry Risk"
          value={stats.total_value_at_risk}
          icon={TrendingUp}
          prefix="₹"
          color="amber"
          subtitle="Expiring in 30 days"
          onClick={() => navigate('/staff/alerts')}
          delay={0.22}
        />
        <StatCard
          title="Prevented Loss"
          value={stats.saved_value}
          icon={ShieldCheck}
          prefix="₹"
          color="emerald"
          subtitle="Via Inter-Hospital Rescue"
          trend={{ value: '+18%', isPositive: true }}
          onClick={() => navigate('/staff/analytics')}
          delay={0.29}
        />
      </div>

      {/* Urgent Local Batches Requiring Redistribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card
          title="Surplus Batches Requiring Redistribution"
          subtitle="Batches with insufficient internal consumption before expiry"
          className="lg:col-span-2"
          hover
          delay={0.12}
          action={
            <button
              type="button"
              onClick={() => navigate('/staff/rescue')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>View AI Recommendations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          {criticalBatches.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              All active pharmacy lots are within safe consumption timelines.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {criticalBatches.map((b, index) => (
                <motion.div key={b.id} initial={reducedMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} whileHover={reducedMotion ? undefined : { x: 3, backgroundColor: 'rgba(248,250,252,0.9)' }} transition={{ delay: index * 0.06, duration: 0.28 }} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs">
                      {b.medicine?.name}
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Lot #{b.batch_number} • {b.quantity} units • Expires {b.expiry_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-red-600">
                      ₹{(b.quantity * b.unit_price).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/staff/rescue')}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg shadow-2xs"
                    >
                      Redistribute
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        {/* Local Expiry Risk Breakdown */}
        <Card
          title="Local Stock Expiry Profile"
          subtitle="Pharmacy stock by days to expiration"
          hover
          delay={0.2}
        >
          <ExpiryDistributionChart data={sampleStaffDistribution} height={260} />
        </Card>
      </div>

      {/* Hospital Rescue Savings Trend */}
      <Card
        title="Waste Reduction & Savings Performance"
        subtitle="Cumulative financial value rescued via MedRescue redistribution network"
        hover
        delay={0.14}
      >
        <RiskTrendChart data={sampleStaffTrends} height={250} />
      </Card>
    </AnimatedPage>
  );
};

export default StaffDashboard;
