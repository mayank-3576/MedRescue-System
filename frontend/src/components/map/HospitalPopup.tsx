import React from 'react';
import { Hospital } from '../../types';
import { Building2, Phone, MapPin, Bed, AlertTriangle, ArrowRight } from 'lucide-react';

interface HospitalPopupProps {
  hospital: Hospital;
  onInitiateTransfer?: () => void;
}

export const HospitalPopup: React.FC<HospitalPopupProps> = ({
  hospital,
  onInitiateTransfer,
}) => {
  return (
    <div className="p-1 font-sans text-slate-800">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
        <div>
          <h4 className="font-bold text-sm text-slate-900 leading-snug">
            {hospital.name}
          </h4>
          <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full inline-block mt-1">
            {hospital.code} • {hospital.type.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-slate-600 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{hospital.address}, {hospital.city}</span>
        </div>
        <div className="flex items-center gap-2">
          <Bed className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{hospital.bed_capacity} Beds Capacity</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{hospital.phone}</span>
        </div>
      </div>

      {(hospital.critical_alerts_count || 0) > 0 && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200/60 rounded-lg flex items-center gap-2 text-xs text-red-700 font-medium">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{hospital.critical_alerts_count} critical batches expiring &lt; 30d</span>
        </div>
      )}

      {onInitiateTransfer && (
        <button
          type="button"
          onClick={onInitiateTransfer}
          className="w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>Select for Redistribution</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default HospitalPopup;
