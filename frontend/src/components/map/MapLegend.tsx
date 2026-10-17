import React from 'react';

export const MapLegend: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 shadow-md text-xs space-y-2 pointer-events-auto ${className}`}>
      <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
        Facility Network Status
      </h5>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-xs" />
          <span className="text-slate-600 font-medium">Critical Expiry Risk (&gt; 3 batches)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-xs" />
          <span className="text-slate-600 font-medium">Moderate Expiry Risk (1-3 batches)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-teal-600 border border-white shadow-xs" />
          <span className="text-slate-600 font-medium">Optimal Stock Level (Govt)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-xs" />
          <span className="text-slate-600 font-medium">Optimal Stock Level (Private)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="w-5 h-1 bg-teal-500 rounded-full" />
          <span className="text-slate-500 text-[11px]">Active Redistribution Route</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;
