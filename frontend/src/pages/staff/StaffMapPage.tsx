import React, { useState, useEffect } from 'react';
import { MapPin, Building, Truck, Navigation } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import HospitalMap from '../../components/map/HospitalMap';
import DeliveryCostPanel from '../../components/map/DeliveryCostPanel';
import { hospitalsApi } from '../../api/hospitals';
import { deliveryApi } from '../../api/delivery';
import { useAuth } from '../../hooks/useAuth';
import { Hospital, DeliveryEstimate } from '../../types';
import toast from 'react-hot-toast';

export const StaffMapPage: React.FC = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospital_id || 'hosp-1';

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [targetHospital, setTargetHospital] = useState<Hospital | null>(null);
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const data = await hospitalsApi.getAll();
        setHospitals(data);
        const other = data.find((h) => h.id !== hospitalId);
        if (other) {
          selectTarget(other, data);
        }
      } catch (e) {
        toast.error('Failed to load partner hospitals');
      } finally {
        setLoading(false);
      }
    };
    loadHospitals();
  }, [hospitalId]);

  const selectTarget = async (target: Hospital, allHospitals = hospitals) => {
    setTargetHospital(target);
    try {
      const est = await deliveryApi.calculateEstimate(hospitalId, target.id, true);
      setEstimate(est);
    } catch (e) {
      // fallback
    }
  };

  const myHospital = hospitals.find((h) => h.id === hospitalId);

  return (
    <AnimatedPage>
      <PageHeader
        title="Regional Healthcare Logistics Network"
        subtitle={`Connected redistribution facilities accessible from ${myHospital?.name || 'Your Facility'}.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <HospitalMap
            hospitals={hospitals}
            selectedHospital={myHospital}
            routeEstimate={estimate}
            onSelectHospital={(h) => {
              if (h.id !== hospitalId) selectTarget(h);
            }}
            height={580}
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Eligible Partner Hospitals"
            subtitle="Click to evaluate delivery distance & transit time"
          >
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {hospitals
                .filter((h) => h.id !== hospitalId)
                .map((h) => (
                  <div
                    key={h.id}
                    onClick={() => selectTarget(h)}
                    className={`py-2.5 px-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                      targetHospital?.id === h.id ? 'bg-teal-50 border border-teal-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">
                        {h.name}
                      </p>
                      <p className="text-[11px] text-slate-500">{h.city} • {h.type}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {h.code}
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          <DeliveryCostPanel
            sourceHospital={myHospital}
            targetHospital={targetHospital || undefined}
            estimate={estimate}
            onConfirmTransfer={() => toast.success('Transfer routing requested')}
          />
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StaffMapPage;
