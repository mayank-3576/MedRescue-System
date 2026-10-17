import React from 'react';
import { useMap } from 'react-leaflet';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import L from 'leaflet';

interface MapControlsProps {
  bounds?: [number, number][];
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export const MapControls: React.FC<MapControlsProps> = ({
  bounds,
  defaultCenter = [28.57, 77.23],
  defaultZoom = 12,
}) => {
  const map = useMap();

  const handleReset = () => {
    map.setView(defaultCenter, defaultZoom);
  };

  const handleFitBounds = () => {
    if (bounds && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(latLngBounds, { padding: [50, 50] });
    } else {
      handleReset();
    }
  };

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  return (
    <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1.5 pointer-events-auto">
      <div className="bg-white rounded-xl shadow-md border border-slate-200/80 overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 text-slate-700 hover:bg-slate-100 hover:text-teal-600 transition-colors border-b border-slate-100"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 text-slate-700 hover:bg-slate-100 hover:text-teal-600 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200/80 overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={handleFitBounds}
          className="p-2 text-slate-700 hover:bg-slate-100 hover:text-teal-600 transition-colors border-b border-slate-100"
          title="Fit All Facilities"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="p-2 text-slate-700 hover:bg-slate-100 hover:text-teal-600 transition-colors"
          title="Reset Center"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MapControls;
