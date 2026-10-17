import apiClient from './client';

export interface DemandCreateInput {
  hospital_id: string;
  medicine_id: string;
  required_quantity: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  demand_date: string;
  notes?: string;
}

export const demandsApi = {
  create: async (data: DemandCreateInput): Promise<void> => {
    await apiClient.post('/demands', { ...data, hospital_id: Number(data.hospital_id), medicine_id: Number(data.medicine_id) });
  },
};
