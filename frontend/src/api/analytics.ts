import apiClient from './client';
import { AnalyticsData } from '../types';

interface AnalyticsOverview {
  risk_breakdown: { risk_level: string; batch_count: number; quantity: number; total_value: number }[];
  hospital_performance: {
    hospital_name: string;
    total_batches: number;
    total_units: number;
    total_inventory_value: number;
  }[];
  transfer_status_breakdown: { status: string; count: number }[];
}

const riskColors: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#14b8a6', normal: '#94a3b8', expired: '#475569',
};

export const analyticsApi = {
  getAnalyticsData: async (_timeRange = '30d'): Promise<AnalyticsData> => {
    const response = await apiClient.get<AnalyticsOverview>('/analytics/overview');
    const overview = response.data;
    return {
      inventory_by_hospital: overview.hospital_performance.map((hospital) => ({
        hospital_name: hospital.hospital_name,
        count: hospital.total_units,
        value: hospital.total_inventory_value,
      })),
      expiry_risk_distribution: overview.risk_breakdown.map((item) => ({
        name: item.risk_level,
        value: item.batch_count,
        color: riskColors[item.risk_level] ?? '#64748b',
      })),
      transfers_by_status: overview.transfer_status_breakdown.map((item) => ({
        status: item.status,
        count: item.count,
      })),
      // The backend records current inventory state, not historical daily snapshots.
      monthly_trends: [],
      value_at_risk_trend: [],
    };
  },

  exportCsv: async (dataType: 'inventory' | 'transfers' | 'alerts' = 'inventory'): Promise<Blob> => {
    const endpoint = dataType === 'inventory' ? 'batches' : dataType;
    const response = await apiClient.get(`/analytics/export/${endpoint}`, { responseType: 'blob' });
    return response.data;
  },
};
