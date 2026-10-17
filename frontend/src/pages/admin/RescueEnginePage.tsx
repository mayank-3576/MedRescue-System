import React, { useState, useEffect } from 'react';
import {
  Zap,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Truck,
  ShieldCheck,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw,
  Building,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HospitalMap from '../../components/map/HospitalMap';
import DeliveryCostPanel from '../../components/map/DeliveryCostPanel';
import { rescueApi } from '../../api/rescue';
import { deliveryApi } from '../../api/delivery';
import { hospitalsApi } from '../../api/hospitals';
import { RescueRecommendation, Hospital, DeliveryEstimate } from '../../types';
import toast from 'react-hot-toast';

export const RescueEnginePage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RescueRecommendation[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedRec, setSelectedRec] = useState<RescueRecommendation | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recData, hospData] = await Promise.all([
        rescueApi.getRecommendations(),
        hospitalsApi.getAll({ is_active: true }),
      ]);
      setRecommendations(recData);
      setHospitals(hospData);
      if (recData.length > 0) {
        selectRecommendation(recData[0]);
      }
    } catch (e) {
      toast.error('Failed to load rescue recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectRecommendation = async (rec: RescueRecommendation) => {
    setSelectedRec(rec);
    try {
      const est = await deliveryApi.calculateEstimate(
        rec.source_hospital_id,
        rec.target_hospital_id,
        true
      );
      setRouteEstimate(est);
    } catch (e) {
      // fallback
    }
  };

  const handleRunRescueEngine = async () => {
    setOptimizing(true);
    try {
      const res = await rescueApi.triggerRescueEngine();
      toast.success(res.message);
      await loadData();
    } catch (e) {
      toast.error('Optimization engine failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleExecute = async (rec: RescueRecommendation) => {
    setExecutingId(rec.id);
    try {
      const res = await rescueApi.executeRecommendation(rec.id);
      toast.success(`Transfer request #${res.transfer_id} submitted for approval.`);
      await loadData();
    } catch (e) {
      toast.error('Failed to initiate transfer');
    } finally {
      setExecutingId(null);
    }
  };

  const sourceHospital = hospitals.find((h) => h.id === selectedRec?.source_hospital_id);
  const targetHospital = hospitals.find((h) => h.id === selectedRec?.target_hospital_id);

  return (
    <AnimatedPage>
      <PageHeader
        title="AI Multi-Facility Medicine Rescue Engine"
        subtitle="Automated bipartite matching engine solving medical surplus, imminent expiration, and urgent demand."
        actions={
          <button
            type="button"
            onClick={handleRunRescueEngine}
            disabled={optimizing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-teal-700/20 transition-all disabled:opacity-50"
          >
            {optimizing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-200" />
            )}
            <span>{optimizing ? 'Calculating Optimal Routes...' : 'Re-Run Optimization'}</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner message="Evaluating multi-hospital inventory and consumption vectors..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Recommendations Cards */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recommended Interventions ({recommendations.length})
              </span>
              <span className="text-xs text-teal-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                Algorithm: Pareto-Optimal
              </span>
            </div>

            {recommendations.map((rec) => {
              const isSelected = selectedRec?.id === rec.id;
              const isTransferred = rec.status === 'transferred';

              return (
                <div
                  key={rec.id}
                  onClick={() => selectRecommendation(rec)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-white relative ${
                    isSelected
                      ? 'border-teal-500 shadow-md ring-2 ring-teal-500/10'
                      : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{rec.medicine_name}</h4>
                      <p className="text-xs text-slate-500">
                        Surplus: <strong className="text-slate-800">{rec.quantity} units</strong> • Expires {rec.expiry_date}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        {rec.match_score}% Match
                      </span>
                    </div>
                  </div>

                  {/* Route Origin to Destination */}
                  <div className="my-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="truncate">From: <strong>{rec.source_hospital_name}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">To: <strong>{rec.target_hospital_name}</strong></span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed italic mb-3">
                    "{rec.reason}"
                  </p>

                  {/* Savings and Cost breakdown */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Prevented Loss</span>
                      <span className="font-bold text-emerald-600">₹{rec.waste_savings.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Est. Transport</span>
                      <span className="font-semibold text-slate-700">₹{rec.estimated_delivery_cost}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecute(rec);
                      }}
                      disabled={isTransferred || executingId === rec.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                        isTransferred
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                    >
                      {isTransferred ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Approved</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>{executingId === rec.id ? 'Processing...' : 'Approve Transfer'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Route Map & Logistics Preview */}
          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Redistribution Route Visualization"
              subtitle={
                selectedRec
                  ? `${selectedRec.source_hospital_name} ➔ ${selectedRec.target_hospital_name}`
                  : 'Select an intervention to inspect route'
              }
            >
              <HospitalMap
                hospitals={hospitals}
                selectedHospital={sourceHospital}
                routeEstimate={routeEstimate}
                center={
                  sourceHospital
                    ? [sourceHospital.latitude, sourceHospital.longitude]
                    : [28.57, 77.23]
                }
                zoom={12}
                height={380}
              />
            </Card>

            <DeliveryCostPanel
              sourceHospital={sourceHospital}
              targetHospital={targetHospital}
              estimate={routeEstimate}
              onConfirmTransfer={
                selectedRec && selectedRec.status !== 'transferred'
                  ? () => handleExecute(selectedRec)
                  : undefined
              }
              loading={executingId === selectedRec?.id}
            />
          </div>
        </div>
      )}
    </AnimatedPage>
  );
};

export default RescueEnginePage;
