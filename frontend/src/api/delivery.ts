import apiClient from './client';
import { DeliveryEstimate } from '../types';

interface BackendRoute {
  distance_km: number;
  estimated_duration_hours: number;
  is_road_distance: boolean;
  cost_per_km: number;
  fixed_charge: number;
  estimated_cost: number;
  route_geometry?: [number, number][];
}

export const deliveryApi = {
  calculateEstimate: async (
    sourceHospitalId: string,
    destinationHospitalId: string,
    _coldChainRequired = false,
  ): Promise<DeliveryEstimate> => {
    const response = await apiClient.post<BackendRoute>('/delivery/calculate-route', {
      source_hospital_id: Number(sourceHospitalId),
      destination_hospital_id: Number(destinationHospitalId),
    });
    const route = response.data;
    return {
      distance_km: route.distance_km,
      estimated_time_minutes: Math.round(route.estimated_duration_hours * 60),
      transport_mode: route.is_road_distance ? 'OSRM road route' : 'Straight-line fallback estimate',
      estimated_cost: route.estimated_cost,
      is_road_distance: route.is_road_distance,
      cost_per_km: route.cost_per_km,
      fixed_charge: route.fixed_charge,
      route_coordinates: (route.route_geometry || []).map(([longitude, latitude]) => [latitude, longitude]),
    };
  },
};
