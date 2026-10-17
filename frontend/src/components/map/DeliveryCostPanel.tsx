import React from 'react';
import { DeliveryEstimate, Hospital } from '../../types';
import { Truck, ShieldCheck } from 'lucide-react';

interface DeliveryCostPanelProps {
  sourceHospital?: Hospital;
  targetHospital?: Hospital;
  estimate?: DeliveryEstimate | null;
  onConfirmTransfer?: () => void;
  loading?: boolean;
}

export const DeliveryCostPanel: React.FC<DeliveryCostPanelProps> = ({
  sourceHospital,
  targetHospital,
  estimate,
  onConfirmTransfer,
  loading = false,
}) => {
  if (!sourceHospital || !targetHospital) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
        Select a source and destination facility on the map to estimate logistics cost & transit duration.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-teal-600" />
          Logistics Route Analysis
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Origin Facility</p>
          <p className="font-semibold text-slate-800 truncate mt-0.5">{sourceHospital.name}</p>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Receiving Facility</p>
          <p className="font-semibold text-slate-800 truncate mt-0.5">{targetHospital.name}</p>
        </div>
      </div>

      {estimate && (
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-teal-50/50 p-2 rounded-lg border border-teal-100">
            <p className="text-[10px] text-teal-600 font-medium">{estimate.is_road_distance ? 'Road distance' : 'Straight line'}</p>
            <p className="text-base font-bold text-teal-900 mt-0.5">{estimate.distance_km} km</p>
          </div>
          <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
            <p className="text-[10px] text-blue-600 font-medium">Modeled travel time</p>
            <p className="text-base font-bold text-blue-900 mt-0.5">{estimate.estimated_time_minutes} min</p>
          </div>
          <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
            <p className="text-[10px] text-emerald-600 font-medium">Estimated Cost</p>
            <p className="text-base font-bold text-emerald-900 mt-0.5">₹{estimate.estimated_cost}</p>
          </div>
        </div>
      )}

      {estimate && (
        <p className="text-[10px] leading-relaxed text-slate-500">
          Cost: {estimate.distance_km.toFixed(2)} km × ₹{estimate.cost_per_km.toFixed(2)}/km + ₹{estimate.fixed_charge.toFixed(2)} fixed = ₹{estimate.estimated_cost.toFixed(2)}. {estimate.transport_mode}.
        </p>
      )}

      {onConfirmTransfer && (
        <button
          type="button"
          onClick={onConfirmTransfer}
          disabled={loading}
          className="w-full mt-2 py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          <ShieldCheck className="w-4 h-4" />
          {loading ? 'Dispatched...' : 'Confirm Inter-Facility Redistribution'}
        </button>
      )}
    </div>
  );
};

export default DeliveryCostPanel;
