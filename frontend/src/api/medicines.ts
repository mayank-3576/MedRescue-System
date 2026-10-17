import apiClient from './client';
import { Medicine } from '../types';

interface BackendMedicine extends Omit<Medicine, 'id' | 'created_at' | 'barcode'> {
  id: number | string;
  created_at?: string;
  updated_at?: string;
  barcode?: string | null;
  total_available_stock?: number;
  total_reserved_stock?: number;
  active_batches_count?: number;
  nearest_expiry_days?: number | null;
}

const mapMedicine = (medicine: BackendMedicine): Medicine => ({
  id: String(medicine.id),
  name: medicine.name,
  generic_name: medicine.generic_name,
  category: medicine.category,
  dosage_form: medicine.dosage_form,
  strength: medicine.strength,
  manufacturer: medicine.manufacturer,
  barcode: medicine.barcode ?? undefined,
  unit_price: medicine.unit_price,
  min_stock_level: medicine.min_stock_level,
  requires_cold_chain: medicine.requires_cold_chain,
  description: undefined,
  created_at: medicine.created_at,
});

export const medicinesApi = {
  getAll: async (params?: { search?: string; category?: string; cold_chain?: boolean }): Promise<Medicine[]> => {
    const response = await apiClient.get<BackendMedicine[]>('/medicines', {
      params: { search: params?.search, category: params?.category === 'all' ? undefined : params?.category },
    });
    const medicines = response.data.map(mapMedicine);
    return params?.cold_chain === undefined
      ? medicines
      : medicines.filter((medicine) => medicine.requires_cold_chain === params.cold_chain);
  },

  getById: async (id: string): Promise<Medicine> => {
    const response = await apiClient.get<BackendMedicine>(`/medicines/${id}`);
    return mapMedicine(response.data);
  },

  getByBarcode: async (barcode: string): Promise<Medicine> => {
    const response = await apiClient.get<BackendMedicine>(`/medicines/by-barcode/${encodeURIComponent(barcode)}`);
    return mapMedicine(response.data);
  },

  create: async (data: Omit<Medicine, 'id'>): Promise<Medicine> => {
    const response = await apiClient.post<BackendMedicine>('/medicines', data);
    return mapMedicine(response.data);
  },

  update: async (id: string, data: Partial<Medicine>): Promise<Medicine> => {
    const response = await apiClient.put<BackendMedicine>(`/medicines/${id}`, data);
    return mapMedicine(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/medicines/${id}`);
  },
};
