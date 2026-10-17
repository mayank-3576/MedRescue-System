import apiClient from './client';
import { ExpiryAlert, RiskLevel } from '../types';

interface BackendAlert {
  id: number;
  batch_id: number;
  hospital_id: number;
  risk_level: RiskLevel;
  days_remaining: number;
  alert_status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  value_at_risk?: number;
  batch_number?: string;
  expiry_date?: string;
  medicine_name?: string;
  hospital_name?: string;
  available_quantity?: number;
  unit_mrp?: number;
}

export interface AlertFilterParams {
  hospital_id?: string;
  risk_level?: RiskLevel | 'all';
  is_resolved?: boolean;
}

const mapAlert = (alert: BackendAlert): ExpiryAlert => ({
  id: String(alert.id),
  batch_id: String(alert.batch_id),
  hospital_id: String(alert.hospital_id),
  risk_level: alert.risk_level,
  days_left: alert.days_remaining,
  estimated_waste_cost: alert.value_at_risk ?? 0,
  alert_date: alert.created_at,
  is_resolved: alert.alert_status === 'resolved',
  resolved_at: alert.alert_status === 'resolved' ? alert.created_at : undefined,
  medicine_name: alert.medicine_name ?? undefined,
  batch_number: alert.batch_number ?? undefined,
  batch_quantity: alert.available_quantity ?? undefined,
  expiry_date: alert.expiry_date ?? undefined,
  hospital_name: alert.hospital_name ?? undefined,
});

export const alertsApi = {
  getAll: async (params?: AlertFilterParams): Promise<ExpiryAlert[]> => {
    const response = await apiClient.get<BackendAlert[]>('/alerts', {
      params: {
        hospital_id: params?.hospital_id && params.hospital_id !== 'all' ? params.hospital_id : undefined,
        risk_level: params?.risk_level && params.risk_level !== 'all' ? params.risk_level : undefined,
        status: params?.is_resolved === undefined ? 'active' : params.is_resolved ? 'resolved' : 'active',
      },
    });
    return response.data.map(mapAlert);
  },

  resolveAlert: async (id: string, _reason?: string): Promise<ExpiryAlert> => {
    const response = await apiClient.put<BackendAlert>(`/alerts/${id}`, { alert_status: 'resolved' });
    return mapAlert(response.data);
  },
};
