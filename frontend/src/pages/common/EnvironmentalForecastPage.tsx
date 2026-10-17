import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CloudSun,
  Wind,
  Droplets,
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Info,
  HelpCircle,
  FileCheck,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import DataTable, { Column } from '../../components/common/DataTable';
import { forecastsApi, QuantityForecast, HospitalForecastSummary, HospitalForecastItem } from '../../api/forecasts';
import { medicinesApi } from '../../api/medicines';
import { hospitalsApi } from '../../api/hospitals';
import { demandsApi } from '../../api/demands';
import { useAuth } from '../../hooks/useAuth';
import { Medicine, Hospital } from '../../types';
import toast from 'react-hot-toast';

export const EnvironmentalForecastPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Facility and Drug Selection
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(user?.hospital_id || '1');
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deep_dive' | 'portfolio'>('deep_dive');

  // Environmental Parameters
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [season, setSeason] = useState<string>('winter');
  const [temperature, setTemperature] = useState<number>(14);
  const [humidity, setHumidity] = useState<number>(45);
  const [aqi, setAqi] = useState<number>(340);
  const [outbreakRisk, setOutbreakRisk] = useState<string>('moderate');
  const [explainerProvider, setExplainerProvider] = useState<string>('rules');

  // Results State
  const [forecast, setForecast] = useState<QuantityForecast | null>(null);
  const [portfolio, setPortfolio] = useState<HospitalForecastSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [portfolioLoading, setPortfolioLoading] = useState<boolean>(false);
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1-Click Weather Presets
  const applyPreset = (presetName: 'monsoon' | 'smog' | 'heatwave' | 'outbreak') => {
    if (presetName === 'monsoon') {
      setSeason('monsoon');
      setTemperature(31);
      setHumidity(86);
      setAqi(75);
      setOutbreakRisk('moderate');
      toast.success('Applied Monsoon Preset: High humidity, vector-borne surge');
    } else if (presetName === 'smog') {
      setSeason('winter');
      setTemperature(11);
      setHumidity(42);
      setAqi(395);
      setOutbreakRisk('moderate');
      toast.success('Applied Winter Smog Preset: Severe AQI, extreme respiratory demand');
    } else if (presetName === 'heatwave') {
      setSeason('summer');
      setTemperature(43);
      setHumidity(22);
      setAqi(130);
      setOutbreakRisk('none');
      toast.success('Applied Summer Heatwave: High dehydration & IV electrolyte demand');
    } else if (presetName === 'outbreak') {
      setSeason('post_monsoon');
      setTemperature(29);
      setHumidity(74);
      setAqi(160);
      setOutbreakRisk('critical');
      toast.success('Applied Critical Outbreak Alert: Emergency buffer scaling active');
    }
  };

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      try {
        const [hospList, medList] = await Promise.all([
          hospitalsApi.getAll({ is_active: true }),
          medicinesApi.getAll(),
        ]);
        setHospitals(hospList);
        setMedicines(medList);
        if (medList.length > 0 && !selectedMedicineId) {
          setSelectedMedicineId(medList[0].id);
        }
        if (hospList.length > 0 && !user?.hospital_id) {
          setSelectedHospitalId(hospList[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial forecast entities', err);
      }
    };
    init();
  }, []);

  // Fetch Single Drug Deep Dive
  const fetchSingleForecast = async () => {
    if (!selectedMedicineId || !selectedHospitalId) return;
    setLoading(true);
    try {
      const data = await forecastsApi.quantity({
        medicineId: selectedMedicineId,
        hospitalId: selectedHospitalId,
        horizonDays,
        season,
        temperature,
        humidity,
        aqi,
        outbreakRisk,
        provider: explainerProvider,
      });
      setForecast(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to calculate environmental forecast';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Hospital-Wide Summary Portfolio
  const fetchPortfolio = async () => {
    if (!selectedHospitalId) return;
    setPortfolioLoading(true);
    try {
      const data = await forecastsApi.getHospitalSummary({
        hospitalId: selectedHospitalId,
        horizonDays,
        season,
        temperature,
        humidity,
        aqi,
        outbreakRisk,
      });
      setPortfolio(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to load hospital portfolio';
      toast.error(msg);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'deep_dive') {
      fetchSingleForecast();
    } else {
      fetchPortfolio();
    }
  }, [
    selectedHospitalId,
    selectedMedicineId,
    horizonDays,
    season,
    temperature,
    humidity,
    aqi,
    outbreakRisk,
    explainerProvider,
    activeTab,
  ]);

  // Create Instant Demand Record
  const handleCreateDemand = async () => {
    if (!forecast) return;
    try {
      await demandsApi.create({
        hospital_id: String(forecast.hospital_id),
        medicine_id: String(forecast.medicine_id),
        required_quantity: forecast.recommended_replenishment,
        priority: forecast.recommended_replenishment > 2000 ? 'critical' : 'high',
        demand_date: new Date().toISOString().slice(0, 10),
        notes: `Predictable AI Auto-Generated Demand for ${forecast.environment.season} season (${forecast.environment.aqi} AQI, ${forecast.environment.temperature_celsius}°C).`,
      });
      toast.success(
        `Demand record created for ${forecast.recommended_replenishment.toLocaleString()} units of ${forecast.medicine_name}!`
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create demand record');
    }
  };

  // Portfolio columns
  const portfolioColumns: Column<HospitalForecastItem>[] = [
    {
      key: 'medicine_name',
      header: 'Formulation & Category',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{item.medicine_name}</span>
          <span className="text-[11px] text-slate-500">
            {item.generic_name} • {item.category}
          </span>
        </div>
      ),
    },
    {
      key: 'current_stock',
      header: 'Current Stock',
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-slate-800 text-xs">
          {item.current_stock.toLocaleString()} units
        </span>
      ),
    },
    {
      key: 'environmental_multiplier',
      header: 'Climate Multiplier',
      sortable: true,
      render: (item) => (
        <span
          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
            item.environmental_multiplier >= 1.5
              ? 'bg-rose-100 text-rose-800'
              : item.environmental_multiplier > 1.0
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {item.environmental_multiplier.toFixed(2)}x
        </span>
      ),
    },
    {
      key: 'predicted_demand',
      header: 'Predicted Demand',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-bold text-slate-900 text-xs block">
            {item.predicted_demand.toLocaleString()} units
          </span>
          <span className="text-[10px] text-slate-400">
            Base: {item.baseline_demand.toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: 'gap',
      header: 'Stockout Gap',
      sortable: true,
      render: (item) => {
        const isDeficit = item.gap < 0;
        return (
          <span
            className={`font-bold text-xs ${
              isDeficit ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {isDeficit ? `-${Math.abs(item.gap).toLocaleString()}` : `+${item.gap.toLocaleString()}`}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Climate Urgency',
      sortable: true,
      render: (item) => {
        if (item.status === 'critical_deficit') {
          return <Badge variant="critical">CRITICAL DEFICIT</Badge>;
        }
        if (item.status === 'moderate_deficit') {
          return <Badge variant="high">MODERATE DEFICIT</Badge>;
        }
        if (item.status === 'surplus') {
          return <Badge variant="low">SURPLUS</Badge>;
        }
        return <Badge variant="default">ADEQUATE</Badge>;
      },
    },
    {
      key: 'action',
      header: 'Recommended Response',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 max-w-[180px] truncate block" title={item.action}>
            {item.action}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedMedicineId(String(item.medicine_id));
              setActiveTab('deep_dive');
            }}
            className="px-2 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors shrink-0"
          >
            Explain
          </button>
        </div>
      ),
    },
  ];

  const filteredPortfolioItems = (portfolio?.predictions || []).filter((item) => {
    if (portfolioFilter !== 'all' && item.status !== portfolioFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.medicine_name.toLowerCase().includes(q) ||
        (item.generic_name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AnimatedPage>
      <PageHeader
        title="Predictable AI: Environmental Medicine Demand Forecaster"
        subtitle="Predict required medicine quantities dynamically modeled against weather, AQI, ambient thermal stress, relative humidity, and outbreak risk."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'deep_dive') fetchSingleForecast();
                else fetchPortfolio();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Forecast</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/admin/rescue' : '/staff/rescue')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Launch AI Rescue Engine</span>
            </button>
          </div>
        }
      />

      {/* Environmental Simulation Control Bar */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <CloudSun className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Climate & Meteorological Input Matrix
              </h2>
              <p className="text-[11px] text-slate-500">
                Adjust clinical environment parameters or trigger real-world Indian epidemiological presets.
              </p>
            </div>
          </div>

          {/* 1-Click Weather Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('monsoon')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1"
            >
              <Droplets className="w-3 h-3 text-blue-500" />
              <span>Monsoon Surge</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('smog')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 transition-colors flex items-center gap-1"
            >
              <Wind className="w-3 h-3 text-slate-600" />
              <span>Winter Smog (AQI 395)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('heatwave')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1"
            >
              <CloudSun className="w-3 h-3 text-amber-600" />
              <span>Summer Heat (43°C)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('outbreak')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>Critical Outbreak</span>
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Hospital Selector (Admin or Staff) */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Target Hospital Node
            </label>
            <select
              value={selectedHospitalId}
              disabled={!isAdmin && !!user?.hospital_id}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-75"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.city}) • {h.bed_capacity} Beds
                </option>
              ))}
            </select>
          </div>

          {/* Season Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Season
            </label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="monsoon">Monsoon (Rainy)</option>
              <option value="winter">Winter (Cold / Smog)</option>
              <option value="summer">Summer (Extreme Heat)</option>
              <option value="post_monsoon">Post-Monsoon (Transitional)</option>
            </select>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Ambient Temp</label>
              <span className="text-xs font-mono font-bold text-teal-700">{temperature}°C</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>5°C</span>
              <span>25°C</span>
              <span>50°C</span>
            </div>
          </div>

          {/* Humidity Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Humidity</label>
              <span className="text-xs font-mono font-bold text-teal-700">{humidity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={humidity}
              onChange={(e) => setHumidity(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>Dry 10%</span>
              <span>Humid 100%</span>
            </div>
          </div>

          {/* AQI Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Air Quality (AQI)</label>
              <span
                className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded ${
                  aqi > 300
                    ? 'bg-purple-100 text-purple-900'
                    : aqi > 200
                    ? 'bg-rose-100 text-rose-800'
                    : aqi > 100
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {aqi}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="500"
              step="5"
              value={aqi}
              onChange={(e) => setAqi(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>Good (50)</span>
              <span>Severe (400+)</span>
            </div>
          </div>

          {/* Outbreak Level */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Outbreak Risk Level
            </label>
            <select
              value={outbreakRisk}
              onChange={(e) => setOutbreakRisk(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="none">None (Routine Baseline)</option>
              <option value="moderate">Moderate (+20% Cluster)</option>
              <option value="high">High (+45% Containment)</option>
              <option value="critical">Critical (+80% Epidemic Emergency)</option>
            </select>
          </div>

          {/* Forecast Horizon */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Forecast Horizon
            </label>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value={7}>7 Days (Immediate Buffer)</option>
              <option value={15}>15 Days (Short-term)</option>
              <option value={30}>30 Days (Standard Month)</option>
              <option value={60}>60 Days (Seasonal)</option>
              <option value={90}>90 Days (Quarterly Surge)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('deep_dive')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'deep_dive'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Single Medicine Deep Dive & XAI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'portfolio'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Hospital-Wide Climate Vulnerability Matrix</span>
          {portfolio?.summary.critical_deficit_count ? (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500 text-white">
              {portfolio.summary.critical_deficit_count} Deficits
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: Single Medicine Deep Dive & XAI */}
      {activeTab === 'deep_dive' && (
        <div className="space-y-6">
          {/* Medicine Selector & Quick Info */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Formulation to Analyze
              </label>
              <select
                value={selectedMedicineId}
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.strength}) • {m.category}
                  </option>
                ))}
              </select>
            </div>

            {forecast && (
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Current Facility Stock</span>
                  <span className="text-sm font-bold text-slate-900">
                    {forecast.current_stock_units.toLocaleString()} units
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Climate Multiplier</span>
                  <span className="text-sm font-mono font-bold text-teal-700">
                    {forecast.environment.combined_multiplier.toFixed(2)}x
                  </span>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                Running Predictable AI Environmental Model & XAI Verification...
              </p>
            </div>
          ) : forecast ? (
            <>
              {/* Stat Cards Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Predicted Climate Demand"
                  value={forecast.forecast_quantity}
                  suffix="units"
                  subtitle={`Over next ${forecast.horizon_days} days (${forecast.environment.combined_multiplier}x baseline)`}
                  icon={TrendingUp}
                  color="blue"
                />

                <StatCard
                  title="Current In-Stock Units"
                  value={forecast.current_stock_units}
                  suffix="units"
                  subtitle={`Available unexpired lots at ${forecast.hospital_name}`}
                  icon={ShieldCheck}
                  color="teal"
                />

                <StatCard
                  title="Recommended Order"
                  value={forecast.recommended_replenishment}
                  suffix="units"
                  subtitle={
                    forecast.recommended_replenishment > 0
                      ? 'Deficit replenishment required'
                      : 'Stock adequate for climate horizon'
                  }
                  icon={AlertTriangle}
                  color={forecast.recommended_replenishment > 0 ? 'rose' : 'emerald'}
                />

                <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-teal-200 uppercase tracking-wider block">
                      Rapid Response
                    </span>
                    <h3 className="text-sm font-bold mt-1">Direct Demand Intake</h3>
                    <p className="text-xs text-teal-100 mt-1">
                      Instantly publish demand record to platform or match via AI Rescue Engine.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCreateDemand}
                      className="px-3 py-1.5 text-xs font-bold bg-white text-teal-900 rounded-lg hover:bg-teal-50 transition-colors shadow-2xs"
                    >
                      Create Demand
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(isAdmin ? '/admin/rescue' : '/staff/rescue')}
                      className="px-3 py-1.5 text-xs font-bold bg-teal-700/80 hover:bg-teal-700 text-white rounded-lg transition-colors border border-teal-500/50"
                    >
                      AI Rescue Match
                    </button>
                  </div>
                </div>
              </div>

              {/* Environmental Multiplier Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Season Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Season Impact</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        forecast.environment.season_factor > 1.0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {forecast.environment.season_factor}x
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {forecast.environment.season_reason}
                  </p>
                </div>

                {/* Temperature Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Thermal Strain</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        forecast.environment.temperature_factor > 1.0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {forecast.environment.temperature_factor}x
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {forecast.environment.temperature_reason}
                  </p>
                </div>

                {/* Humidity Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Humidity Vector</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        forecast.environment.humidity_factor > 1.0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {forecast.environment.humidity_factor}x
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {forecast.environment.humidity_reason}
                  </p>
                </div>

                {/* AQI Smog Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">AQI Smog Surge</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        forecast.environment.aqi_factor > 1.0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {forecast.environment.aqi_factor}x
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {forecast.environment.aqi_reason}
                  </p>
                </div>

                {/* Outbreak Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Epidemic Alert</span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        forecast.environment.outbreak_factor > 1.0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {forecast.environment.outbreak_factor}x
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {forecast.environment.outbreak_reason}
                  </p>
                </div>
              </div>

              {/* Explainable AI (XAI) Mathematical Grounding Section */}
              <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-teal-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Explainable AI (XAI) Grounding & Mathematical Audit
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      100% verified database grounding with zero hallucinations. Every variable is anchored to audited database records.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">LLM Explainer Engine:</span>
                    <select
                      value={explainerProvider}
                      onChange={(e) => setExplainerProvider(e.target.value)}
                      className="text-xs bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1 font-semibold text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="rules">Grounded Deterministic Engine (Zero Error)</option>
                      <option value="openai">OpenAI GPT-4o Grounded</option>
                      <option value="anthropic">Claude 3.5 Sonnet Grounded</option>
                    </select>
                  </div>
                </div>

                {/* Narrative AI Output */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Clinical AI Recommendation & Reasoning:
                    </span>
                    <span className="text-[10px] font-mono bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">
                      {forecast.explainable_ai.guaranteed_accuracy}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans">
                    {forecast.explainable_ai.explanation}
                  </p>
                </div>

                {/* Mathematical Audit Table & Feature Importance Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Facts Audit Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Audited Fact Registry</span>
                      <span className="text-[10px] text-slate-500">Exact Database Values</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {forecast.explainable_ai.grounding_audit.map((fact, idx) => (
                        <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">{fact.metric}</span>
                          <span className="font-mono font-bold text-slate-900">{fact.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature Importance */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800">Feature Importance Weights</span>
                        <span className="text-[10px] text-teal-700 font-bold">Total: 100%</span>
                      </div>
                      <div className="space-y-2">
                        {forecast.explainable_ai.feature_importance.map((f, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span className="text-slate-700 font-medium">{f.feature}</span>
                              <span className="font-mono font-bold text-slate-900">{f.weight_pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-600 rounded-full"
                                style={{ width: `${f.weight_pct}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>
                        Calculated via formula: Demand = (Bed Capacity × Standard Rate) × Environmental Composite Multiplier.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 2: Hospital-Wide Climate Vulnerability Matrix */}
      {activeTab === 'portfolio' && (
        <div className="space-y-5">
          {/* Portfolio KPI Bar */}
          {portfolio && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatCard
                title="Medicines Evaluated"
                value={portfolio.summary.total_medicines_analyzed}
                subtitle={`For ${portfolio.hospital_name} (${portfolio.bed_capacity} beds)`}
                icon={Building2}
                color="teal"
              />

              <StatCard
                title="Critical Stockout Deficits"
                value={portfolio.summary.critical_deficit_count}
                subtitle="Formulations where climate demand exceeds stock"
                icon={AlertTriangle}
                color={portfolio.summary.critical_deficit_count > 0 ? 'rose' : 'emerald'}
              />

              <StatCard
                title="Total Predicted Demand"
                value={portfolio.summary.total_predicted_units}
                suffix="units"
                subtitle={`Under current ${portfolio.environment.season} climate model`}
                icon={TrendingUp}
                color="blue"
              />

              <StatCard
                title="Total Units in Deficit"
                value={portfolio.summary.total_deficit_units}
                suffix="units"
                subtitle="Required replenishment volume across all lines"
                icon={Zap}
                color="amber"
              />
            </div>
          )}

          {/* Filtering and Search Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search formulation, generic name, or category..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-bold text-slate-400">Filter Urgency:</span>
              <select
                value={portfolioFilter}
                onChange={(e) => setPortfolioFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Formulations</option>
                <option value="critical_deficit">Critical Deficit Only</option>
                <option value="moderate_deficit">Moderate Deficit Only</option>
                <option value="adequate">Adequate Levels Only</option>
                <option value="surplus">Surplus Only</option>
              </select>
            </div>
          </div>

          {/* Portfolio Data Table */}
          <DataTable
            columns={portfolioColumns}
            data={filteredPortfolioItems}
            keyExtractor={(item) => String(item.medicine_id)}
            loading={portfolioLoading}
          />
        </div>
      )}
    </AnimatedPage>
  );
};

export default EnvironmentalForecastPage;
