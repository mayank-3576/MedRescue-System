import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Hospital, DeliveryEstimate } from '../../types';
import MapMarker from './MapMarker';
import RouteDisplay from './RouteDisplay';
import MapLegend from './MapLegend';
import MapControls from './MapControls';

interface HospitalMapProps {
  hospitals: Hospital[];
  selectedHospital?: Hospital | null;
  onSelectHospital?: (hospital: Hospital) => void;
  onInitiateTransfer?: (hospital: Hospital) => void;
  routeEstimate?: DeliveryEstimate | null;
  center?: [number, number];
  zoom?: number;
  height?: string | number;
  showLegend?: boolean;
}

export const HospitalMap: React.FC<HospitalMapProps> = ({
  hospitals,
  selectedHospital,
  onSelectHospital,
  onInitiateTransfer,
  routeEstimate,
  center = [28.57, 77.23], // Default Delhi NCR
  zoom = 12,
  height = '500px',
  showLegend = true,
}) => {
  const allCoordinates: [number, number][] = hospitals.map((h) => [h.latitude, h.longitude]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-card bg-slate-100"
      style={{ height, width: '100%' }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-10"
      >
        {/* OpenStreetMap Standard Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Custom Map Controls */}
        <MapControls
          bounds={allCoordinates}
          defaultCenter={center}
          defaultZoom={zoom}
        />

        {/* Hospital Markers */}
        {hospitals.map((hospital) => (
          <MapMarker
            key={hospital.id}
            hospital={hospital}
            isSelected={selectedHospital?.id === hospital.id}
            onSelect={onSelectHospital}
            onInitiateTransfer={onInitiateTransfer}
          />
        ))}

        {/* Route Polyline if Estimate available */}
        {routeEstimate?.route_coordinates && (
          <RouteDisplay
            coordinates={routeEstimate.route_coordinates}
            distanceKm={routeEstimate.distance_km}
            timeMinutes={routeEstimate.estimated_time_minutes}
            coldChain={false}
          />
        )}
      </MapContainer>

      {/* Map Legend Overlay */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-[400]">
          <MapLegend />
        </div>
      )}
    </div>
  );
};

export default HospitalMap;
