import apiClient from './client';
import { Hospital } from '../types';
import { hospitalsApi } from './hospitals';

interface HospitalMapMetrics {
  id: number | string;
  active_alerts_count: number;
  critical_alerts_count: number;
  total_batches: number;
}

export const mapApi = {
  getHospitals: async (): Promise<Hospital[]> => {
    const [hospitals, metricsResponse] = await Promise.all([
      hospitalsApi.getAll(),
      apiClient.get<HospitalMapMetrics[]>('/map/hospitals'),
    ]);
    const metrics = new Map(metricsResponse.data.map((item) => [String(item.id), item]));
    return hospitals
      .filter((hospital) => hospital.is_active !== false && metrics.has(hospital.id))
      .map((hospital) => {
        const item = metrics.get(hospital.id)!;
        return {
          ...hospital,
          critical_alerts_count: item.critical_alerts_count,
          total_inventory_count: item.total_batches,
        };
      });
  },
};
