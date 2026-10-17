import apiClient from './client';
import { RescueRecommendation } from '../types';
import { hospitalsApi } from './hospitals';

interface BackendRecommendation {
  batch_id: number;
  batch_number: string;
  medicine_id: number;
  medicine_name: string;
  source_hospital_id: number;
  source_hospital_name: string;
  source_latitude: number;
  source_longitude: number;
  destination_hospital_id: number;
  destination_hospital_name: string;
  destination_latitude: number;
  destination_longitude: number;
  expiry_date: string;
  days_to_expiry: number;
  recommended_transfer_quantity: number;
  estimated_distance_km: number;
  estimated_delivery_cost: number;
  net_value_saved: number;
  feasibility_score: number;
  demand_priority: string;
  rationale: string;
}

interface RescueEngineResponse {
  recommendations: BackendRecommendation[];
}

const mapRecommendation = (item: BackendRecommendation): RescueRecommendation => ({
  id: `${item.batch_id}-${item.destination_hospital_id}-${item.recommended_transfer_quantity}`,
  batch_id: String(item.batch_id),
  medicine_name: item.medicine_name,
  quantity: item.recommended_transfer_quantity,
  expiry_date: item.expiry_date,
  source_hospital_id: String(item.source_hospital_id),
  source_hospital_name: item.source_hospital_name,
  source_location: [item.source_latitude, item.source_longitude],
  target_hospital_id: String(item.destination_hospital_id),
  target_hospital_name: item.destination_hospital_name,
  target_location: [item.destination_latitude, item.destination_longitude],
  match_score: item.feasibility_score,
  demand_urgency: ['routine', 'urgent', 'emergency'].includes(item.demand_priority)
    ? item.demand_priority as RescueRecommendation['demand_urgency']
    : 'routine',
  distance_km: item.estimated_distance_km,
  estimated_delivery_cost: item.estimated_delivery_cost,
  waste_savings: item.net_value_saved,
  status: 'recommended',
  reason: item.rationale,
});

const getEngineResult = async (hospitalId?: string): Promise<BackendRecommendation[]> => {
  const response = await apiClient.get<RescueEngineResponse>('/rescue/recommendations', {
    params: { hospital_id: hospitalId && hospitalId !== 'all' ? hospitalId : undefined },
  });
  return response.data.recommendations;
};

export const rescueApi = {
  getRecommendations: async (hospitalId?: string): Promise<RescueRecommendation[]> => {
    return (await getEngineResult(hospitalId)).map(mapRecommendation);
  },

  triggerRescueEngine: async (): Promise<{ message: string; generated_count: number }> => {
    const recommendations = await getEngineResult();
    return {
      message: `Calculated ${recommendations.length} current recommendations from eligible stock and recorded demand.`,
      generated_count: recommendations.length,
    };
  },

  executeRecommendation: async (recommendationId: string): Promise<{ success: boolean; transfer_id: string }> => {
    const [batchId, destinationHospitalId, quantity] = recommendationId.split('-').map(Number);
    if (![batchId, destinationHospitalId, quantity].every(Number.isFinite)) {
      throw new Error('Invalid recommendation identifier');
    }
    const response = await apiClient.post<{ id: number }>('/rescue/execute', {
      batch_id: batchId,
      destination_hospital_id: destinationHospitalId,
      quantity,
    });
    return { success: true, transfer_id: String(response.data.id) };
  },

  dismissRecommendation: async (_recommendationId: string): Promise<void> => {
    throw new Error('Recommendation dismissal is not supported by the backend workflow.');
  },
};
