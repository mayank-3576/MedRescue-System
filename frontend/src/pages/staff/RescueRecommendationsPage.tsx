import React, { useState, useEffect } from 'react';
import {
  Zap,
  Building,
  ArrowRight,
  CheckCircle,
  Truck,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HospitalMap from '../../components/map/HospitalMap';
import DeliveryCostPanel from '../../components/map/DeliveryCostPanel';
import { rescueApi } from '../../api/rescue';
import { hospitalsApi } from '../../api/hospitals';
import { deliveryApi } from '../../api/delivery';
import { useAuth } from '../../hooks/useAuth';
import { RescueRecommendation, Hospital, DeliveryEstimate } from '../../types';
import toast from 'react-hot-toast';

export const RescueRecommendationsPage: React.FC = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [recommendations, setRecommendations] = useState<RescueRecommendation[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedRec, setSelectedRec] = useState<RescueRecommendation | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, hosps] = await Promise.all([
        rescueApi.getRecommendations(hospitalId),
        hospitalsApi.getAll({ is_active: true }),
      ]);
      setRecommendations(recs);
      setHospitals(hosps);
      if (recs.length > 0) {
        selectRec(recs[0]);
      }
    } catch (e) {
      toast.error('Failed to load rescue recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  const selectRec = async (rec: RescueRecommendation) => {
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

  const handleExecute = async (rec: RescueRecommendation) => {
    setExecuting(true);
    try {
      const res = await rescueApi.executeRecommendation(rec.id);
      toast.success(`Transfer #${res.transfer_id} initiated! Logistics scheduled.`);
      await loadData();
    } catch (e) {
      toast.error('Failed to execute transfer');
    } finally {
      setExecuting(false);
    }
  };

  const sourceHosp = hospitals.find((h) => h.id === selectedRec?.source_hospital_id);
  const targetHosp = hospitals.find((h) => h.id === selectedRec?.target_hospital_id);

  return (
    <AnimatedPage>
      <PageHeader
        title="AI Redistribution Recommendations"
        subtitle={`Intelligent inter-hospital matching for ${user?.hospital_name || 'Hospital'}.`}
      />

      {loading ? (
        <LoadingSpinner message="Calculating partner facility consumption..." />
      ) : recommendations.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-slate-500 text-xs">
            No active surplus or urgent deficit matches for this facility at the moment.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Active Matches ({recommendations.length})
            </h4>

            {recommendations.map((rec) => {
              const isSelected = selectedRec?.id === rec.id;
              const isTransferred = rec.status === 'transferred';
              const isOutbound = rec.source_hospital_id === hospitalId;

              return (
                <div
                  key={rec.id}
                  onClick={() => selectRec(rec)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                    isSelected
                      ? 'border-teal-500 shadow-md ring-2 ring-teal-500/10'
                      : 'border-slate-200/80 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOutbound ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {isOutbound ? 'Outbound Surplus' : 'Inbound Supply'}
                        </span>
                        <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {rec.match_score}% Match
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{rec.medicine_name}</h4>
                      <p className="text-xs text-slate-500">
                        {rec.quantity} units • Expiry: {rec.expiry_date}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg my-2.5">
                    "{rec.reason}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Prevented Loss</span>
                      <span className="font-bold text-emerald-600">₹{rec.waste_savings.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecute(rec);
                      }}
                      disabled={isTransferred || executing}
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
                          <span>Authorize Redistribution</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <Card
              title="Redistribution Transit Map"
              subtitle={
                selectedRec
                  ? `${selectedRec.source_hospital_name} ➔ ${selectedRec.target_hospital_name}`
                  : 'Map View'
              }
            >
              <HospitalMap
                hospitals={hospitals}
                selectedHospital={sourceHosp}
                routeEstimate={routeEstimate}
                height={380}
              />
            </Card>

            <DeliveryCostPanel
              sourceHospital={sourceHosp}
              targetHospital={targetHosp}
              estimate={routeEstimate}
              onConfirmTransfer={
                selectedRec && selectedRec.status !== 'transferred'
                  ? () => handleExecute(selectedRec)
                  : undefined
              }
              loading={executing}
            />
          </div>
        </div>
      )}
    </AnimatedPage>
  );
};

export default RescueRecommendationsPage;
