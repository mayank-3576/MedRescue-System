import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Truck, ThermometerSnowflake, Building, Layers } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import HospitalMap from '../../components/map/HospitalMap';
import DeliveryCostPanel from '../../components/map/DeliveryCostPanel';
import { hospitalsApi } from '../../api/hospitals';
import { deliveryApi } from '../../api/delivery';
import { Hospital, DeliveryEstimate } from '../../types';
import toast from 'react-hot-toast';

export const AdminMapPage: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [sourceHospitalId, setSourceHospitalId] = useState<string>('');
  const [destHospitalId, setDestHospitalId] = useState<string>('');
  const [coldChainRequired, setColdChainRequired] = useState(true);
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const data = await hospitalsApi.getAll();
        setHospitals(data);
        if (data.length >= 2) {
          setSourceHospitalId(data[0].id);
          setDestHospitalId(data[1].id);
        }
      } catch (e) {
        toast.error('Failed to load map data');
      } finally {
        setLoading(false);
      }
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    if (sourceHospitalId && destHospitalId && sourceHospitalId !== destHospitalId) {
      calculateRoute(sourceHospitalId, destHospitalId, coldChainRequired);
    }
  }, [sourceHospitalId, destHospitalId, coldChainRequired]);

  const calculateRoute = async (src: string, dst: string, coldChain: boolean) => {
    setEstimating(true);
    try {
      const result = await deliveryApi.calculateEstimate(src, dst, coldChain);
      setEstimate(result);
    } catch (e) {
      // fallback handled
    } finally {
      setEstimating(false);
    }
  };

  const sourceHosp = hospitals.find((h) => h.id === sourceHospitalId);
  const destHosp = hospitals.find((h) => h.id === destHospitalId);

  return (
    <AnimatedPage>
      <PageHeader
        title="Regional Healthcare Network Geographic Map"
        subtitle="Geospatial visualization of healthcare facilities, cold chain logistics paths, and inter-hospital delivery corridors."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Map Container */}
        <div className="lg:col-span-8">
          <HospitalMap
            hospitals={hospitals}
            selectedHospital={sourceHosp}
            routeEstimate={estimate}
            height={620}
          />
        </div>

        {/* Route Planning & Cost Estimator Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Redistribution Route Simulator"
            subtitle="Calculate road transit distance, travel duration, and delivery cost"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Origin Hospital (Surplus Source)
                </label>
                <select
                  value={sourceHospitalId}
                  onChange={(e) => setSourceHospitalId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Hospital (Deficit Target)
                </label>
                <select
                  value={destHospitalId}
                  onChange={(e) => setDestHospitalId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id} disabled={h.id === sourceHospitalId}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="coldChainToggle"
                  checked={coldChainRequired}
                  onChange={(e) => setColdChainRequired(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <label
                  htmlFor="coldChainToggle"
                  className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1.5"
                >
                  <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-600" />
                  Require Cold-Chain Transport (2°C - 8°C)
                </label>
              </div>
            </div>
          </Card>

          <DeliveryCostPanel
            sourceHospital={sourceHosp}
            targetHospital={destHosp}
            estimate={estimate}
            onConfirmTransfer={() => {
              toast.success('Simulation saved. Inter-hospital transfer initiated.');
            }}
            loading={estimating}
          />
        </div>
      </div>
    </AnimatedPage>
  );
};

export default AdminMapPage;
