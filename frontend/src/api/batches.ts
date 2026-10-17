import apiClient from './client';
import { Medicine, MedicineBatch, RiskLevel } from '../types';

interface BackendBatch {
  id: number | string;
  medicine_id: number | string;
  hospital_id: number | string;
  batch_number: string;
  available_quantity: number;
  reserved_quantity: number;
  unit_mrp: number;
  unit_purchase_cost: number;
  manufacturing_date: string;
  expiry_date: string;
  storage_requirements?: string | null;
  status: string;
  days_to_expiry?: number;
  risk_level?: RiskLevel;
  total_batch_value?: number;
  medicine_name?: string;
  generic_name?: string;
  dosage_form?: string;
  strength?: string;
  category?: string;
  hospital_name?: string;
  hospital_city?: string;
  is_demo?: boolean;
  created_at?: string;
}

export interface QuickScanAddResult {
  success: boolean;
  message: string;
  medicine_id: number;
  medicine_name: string;
  generic_name: string;
  strength: string;
  barcode: string;
  batch_id: number;
  batch_number: string;
  added_quantity: number;
  available_quantity: number;
  expiry_date: string;
  days_to_expiry: number;
  risk_level: string;
  hospital_id: number;
  hospital_name: string;
  is_newly_registered_medicine: boolean;
}

export interface QuickScanAddParams {
  barcode: string;
  hospital_id?: string | number;
  quantity?: number;
  batch_number?: string;
  expiry_date?: string;
  manufacturing_date?: string;
  unit_mrp?: number;
  unit_purchase_cost?: number;
  storage_requirements?: string;
}

const mapBatch = (batch: BackendBatch): MedicineBatch => {
  const medicine: Medicine | undefined = batch.medicine_name ? {
    id: String(batch.medicine_id),
    name: batch.medicine_name,
    generic_name: batch.generic_name || '',
    category: batch.category || '',
    dosage_form: batch.dosage_form || '',
    strength: batch.strength || '',
    manufacturer: 'Not recorded on batch summary',
    unit_price: batch.unit_mrp,
    min_stock_level: 0,
    requires_cold_chain: /cold|2\s*°?c\s*(to|-)\s*8\s*°?c/i.test(batch.storage_requirements || ''),
  } : undefined;

  return {
    id: String(batch.id),
    medicine_id: String(batch.medicine_id),
    hospital_id: String(batch.hospital_id),
    batch_number: batch.batch_number,
    quantity: batch.available_quantity,
    reserved_quantity: batch.reserved_quantity,
    expiry_date: batch.expiry_date,
    manufacturing_date: batch.manufacturing_date,
    unit_price: batch.unit_mrp,
    unit_purchase_cost: batch.unit_purchase_cost,
    status: batch.status === 'active' && (batch.days_to_expiry ?? 91) <= 90 ? 'expiring_soon' : batch.status as MedicineBatch['status'],
    storage_condition: batch.storage_requirements || undefined,
    medicine,
    days_to_expiry: batch.days_to_expiry,
    value_at_risk: batch.total_batch_value,
    risk_level: batch.risk_level,
    created_at: batch.created_at,
  };
};

export interface BatchFilterParams {
  hospital_id?: string;
  medicine_id?: string;
  status?: string;
  risk_level?: string;
  search?: string;
}

const toBackend = (data: Partial<MedicineBatch>) => ({
  medicine_id: data.medicine_id,
  hospital_id: data.hospital_id,
  batch_number: data.batch_number,
  available_quantity: data.quantity,
  unit_mrp: data.unit_price,
  unit_purchase_cost: data.unit_purchase_cost ?? data.unit_price,
  manufacturing_date: data.manufacturing_date,
  expiry_date: data.expiry_date,
  storage_requirements: data.storage_condition,
  status: data.status === 'expiring_soon' ? 'active' : data.status,
});

export const batchesApi = {
  getAll: async (params?: BatchFilterParams): Promise<MedicineBatch[]> => {
    const response = await apiClient.get<BackendBatch[]>('/batches', {
      params: {
        hospital_id: params?.hospital_id && params.hospital_id !== 'all' ? params.hospital_id : undefined,
        medicine_id: params?.medicine_id && params.medicine_id !== 'all' ? params.medicine_id : undefined,
        status: params?.status && params.status !== 'all' && params.status !== 'expiring_soon' ? params.status : undefined,
        risk_level: params?.risk_level && params.risk_level !== 'all' ? params.risk_level : undefined,
        search: params?.search,
      },
    });
    let batches = response.data.map(mapBatch);
    if (params?.status === 'expiring_soon') batches = batches.filter((batch) => batch.status === 'expiring_soon');
    return batches;
  },

  getById: async (id: string): Promise<MedicineBatch> => {
    const response = await apiClient.get<BackendBatch>(`/batches/${id}`);
    return mapBatch(response.data);
  },

  quickScanAdd: async (params: QuickScanAddParams): Promise<QuickScanAddResult> => {
    const response = await apiClient.post<QuickScanAddResult>('/batches/quick-scan-add', params);
    return response.data;
  },

  create: async (data: Omit<MedicineBatch, 'id'>): Promise<MedicineBatch> => {
    const response = await apiClient.post<BackendBatch>('/batches', { ...toBackend(data), reserved_quantity: 0 });
    return mapBatch(response.data);
  },

  update: async (id: string, data: Partial<MedicineBatch>): Promise<MedicineBatch> => {
    const response = await apiClient.put<BackendBatch>(`/batches/${id}`, toBackend(data));
    return mapBatch(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/batches/${id}`);
  },
};
