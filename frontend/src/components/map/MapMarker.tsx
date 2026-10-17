import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Hospital } from '../../types';
import HospitalPopup from './HospitalPopup';

interface MapMarkerProps {
  hospital: Hospital;
  isSelected?: boolean;
  onSelect?: (hospital: Hospital) => void;
  onInitiateTransfer?: (hospital: Hospital) => void;
}

export const MapMarker: React.FC<MapMarkerProps> = ({
  hospital,
  isSelected,
  onSelect,
  onInitiateTransfer,
}) => {
  // Determine color based on hospital type and critical alerts
  let colorClass = '#0D9488'; // teal default
  if ((hospital.critical_alerts_count || 0) > 3) {
    colorClass = '#EF4444'; // critical red
  } else if ((hospital.critical_alerts_count || 0) > 0) {
    colorClass = '#F97316'; // warning orange
  } else if (hospital.type === 'private') {
    colorClass = '#3B82F6'; // blue
  }

  const customIcon = L.divIcon({
    className: 'custom-hospital-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background-color: ${colorClass};
        color: white;
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        border: 3px solid #ffffff;
        cursor: pointer;
        transition: transform 0.2s ease;
        ${isSelected ? 'outline: 4px solid #14B8A6; transform: scale(1.15);' : ''}
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6v12M6 12h12"/>
        </svg>
        ${
          (hospital.critical_alerts_count || 0) > 0
            ? `<span style="
                position: absolute;
                top: -4px;
                right: -4px;
                background-color: #EF4444;
                color: #ffffff;
                font-size: 10px;
                font-weight: bold;
                border-radius: 9999px;
                padding: 1px 5px;
                border: 1.5px solid #ffffff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              ">${hospital.critical_alerts_count}</span>`
            : ''
        }
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });

  return (
    <Marker
      position={[hospital.latitude, hospital.longitude]}
      icon={customIcon}
      eventHandlers={{
        click: () => onSelect && onSelect(hospital),
      }}
    >
      <Popup className="hospital-leaflet-popup" minWidth={280}>
        <HospitalPopup
          hospital={hospital}
          onInitiateTransfer={() => onInitiateTransfer && onInitiateTransfer(hospital)}
        />
      </Popup>
    </Marker>
  );
};

export default MapMarker;
