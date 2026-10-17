import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';

interface RouteDisplayProps {
  coordinates: [number, number][];
  distanceKm?: number;
  timeMinutes?: number;
  coldChain?: boolean;
}

export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  coordinates,
  distanceKm,
  timeMinutes,
  coldChain = false,
}) => {
  if (!coordinates || coordinates.length < 2) return null;

  return (
    <Polyline
      positions={coordinates}
      pathOptions={{
        color: coldChain ? '#06B6D4' : '#0D9488',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
      }}
    >
      {(distanceKm !== undefined || timeMinutes !== undefined) && (
        <Tooltip sticky direction="top" className="route-leaflet-tooltip">
          <div className="text-xs font-sans font-medium text-slate-800 p-0.5">
            <span className="font-bold text-teal-700">
              {coldChain ? '❄️ Cold-Chain Transit: ' : '🚚 Transit: '}
            </span>
            {distanceKm && <span>{distanceKm} km</span>}
            {timeMinutes && <span> (~{timeMinutes} mins)</span>}
          </div>
        </Tooltip>
      )}
    </Polyline>
  );
};

export default RouteDisplay;
