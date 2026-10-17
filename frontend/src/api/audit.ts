import apiClient from './client';
import { AuditLog } from '../types';

interface BackendAuditLog {
  id: number | string;
  user_id?: number | string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  details?: unknown;
  ip_address?: string | null;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
}

export const auditApi = {
  getAuditLogs: async (params?: { search?: string; action?: string; limit?: number }): Promise<AuditLog[]> => {
    const response = await apiClient.get<BackendAuditLog[]>('/audit', {
      params: { action: params?.action && params.action !== 'all' ? params.action : undefined, limit: params?.limit ?? 100 },
    });
    let logs: AuditLog[] = response.data.map((log) => ({
      id: String(log.id),
      user_id: log.user_id == null ? '' : String(log.user_id),
      user_email: log.user_email || 'System',
      timestamp: log.created_at,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: String(log.entity_id ?? ''),
      details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details ?? ''),
      ip_address: log.ip_address || '',
    }));
    if (params?.search) {
      const query = params.search.toLowerCase();
      logs = logs.filter((log) => `${log.action} ${log.user_email} ${log.details}`.toLowerCase().includes(query));
    }
    return logs;
  },
};
