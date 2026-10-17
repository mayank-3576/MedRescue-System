import apiClient from './client';
import { DashboardStats } from '../types';

interface DashboardSummary {
  total_medicines: number;
  total_batches: number;
  total_hospitals: number;
  value_at_risk: number;
  critical_alerts_count: number;
  high_alerts_count: number;
  pending_transfers_count: number;
  completed_transfers_count: number;
  rescued_value_total: number;
}

const getSummary = async (hospitalId?: string): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardSummary>('/dashboard/summary', {
    params: hospitalId ? { hospital_id: hospitalId } : undefined,
  });
  const summary = response.data;
  return {
    total_hospitals: summary.total_hospitals,
    total_medicines: summary.total_medicines,
    active_batches: summary.total_batches,
    critical_alerts: summary.critical_alerts_count,
    high_risk_alerts: summary.high_alerts_count,
    total_value_at_risk: summary.value_at_risk,
    saved_value: summary.rescued_value_total,
    pending_transfers: summary.pending_transfers_count,
    completed_transfers: summary.completed_transfers_count,
  };
};

export const dashboardApi = {
  getAdminStats: (): Promise<DashboardStats> => getSummary(),
  getStaffStats: (hospitalId: string): Promise<DashboardStats> => getSummary(hospitalId),
};
