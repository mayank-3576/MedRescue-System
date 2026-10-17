import apiClient from './client';
import { TransferRequest, TransferStatus } from '../types';

interface BackendTransfer {
  id: number | string;
  source_hospital_id: number | string;
  destination_hospital_id: number | string;
  batch_id: number | string;
  medicine_id: number | string;
  requested_quantity: number;
  approved_quantity: number;
  dispatched_quantity: number;
  received_quantity: number;
  urgency: TransferRequest['urgency'];
  status: string;
  source_hospital_name?: string | null;
  destination_hospital_name?: string | null;
  medicine_name?: string | null;
  batch_number?: string | null;
  requester_name?: string | null;
  approver_name?: string | null;
  route_distance_km?: number | null;
  delivery_cost?: number | null;
  created_at: string;
  updated_at?: string;
  notes?: string | null;
}

const toUiStatus = (status: string): TransferStatus => ({
  pending_approval: 'pending',
  dispatched: 'in_transit',
  received: 'delivered',
} as Record<string, TransferStatus>)[status] || status as TransferStatus;

const toBackendStatus = (status: string) => ({
  pending: 'pending_approval',
  in_transit: 'dispatched',
  delivered: 'received',
} as Record<string, string>)[status] || status;

const mapTransfer = (transfer: BackendTransfer): TransferRequest => ({
  id: String(transfer.id),
  source_hospital_id: String(transfer.source_hospital_id),
  destination_hospital_id: String(transfer.destination_hospital_id),
  medicine_id: String(transfer.medicine_id),
  batch_id: String(transfer.batch_id),
  quantity: transfer.requested_quantity,
  approved_quantity: transfer.approved_quantity,
  dispatched_quantity: transfer.dispatched_quantity,
  received_quantity: transfer.received_quantity,
  urgency: transfer.urgency,
  status: toUiStatus(transfer.status),
  source_hospital_name: transfer.source_hospital_name ?? undefined,
  destination_hospital_name: transfer.destination_hospital_name ?? undefined,
  medicine_name: transfer.medicine_name ?? undefined,
  batch_number: transfer.batch_number ?? undefined,
  requested_by: transfer.requester_name ?? undefined,
  approved_by: transfer.approver_name ?? undefined,
  tracking_code: `TR-${transfer.id}`,
  created_at: transfer.created_at,
  updated_at: transfer.updated_at,
  notes: transfer.notes ?? undefined,
  distance_km: transfer.route_distance_km ?? undefined,
  estimated_cost: transfer.delivery_cost ?? undefined,
});

export interface TransferFilterParams {
  hospital_id?: string;
  status?: string;
  urgency?: string;
  search?: string;
}

export const transfersApi = {
  getAll: async (params?: TransferFilterParams): Promise<TransferRequest[]> => {
    const status = params?.status && params.status !== 'all' ? toBackendStatus(params.status) : undefined;
    const response = await apiClient.get<BackendTransfer[]>('/transfers', {
      params: { hospital_id: params?.hospital_id && params.hospital_id !== 'all' ? params.hospital_id : undefined, status },
    });
    let transfers = response.data.map(mapTransfer);
    if (params?.urgency && params.urgency !== 'all') transfers = transfers.filter((transfer) => transfer.urgency === params.urgency);
    if (params?.search) {
      const query = params.search.toLowerCase();
      transfers = transfers.filter((transfer) =>
        [transfer.tracking_code, transfer.medicine_name, transfer.source_hospital_name, transfer.destination_hospital_name]
          .some((value) => value?.toLowerCase().includes(query))
      );
    }
    return transfers;
  },

  getById: async (id: string): Promise<TransferRequest> => {
    const response = await apiClient.get<BackendTransfer>(`/transfers/${id}`);
    return mapTransfer(response.data);
  },

  create: async (data: Partial<TransferRequest>): Promise<TransferRequest> => {
    const response = await apiClient.post<BackendTransfer>('/transfers', {
      source_hospital_id: data.source_hospital_id,
      destination_hospital_id: data.destination_hospital_id,
      medicine_id: data.medicine_id,
      batch_id: data.batch_id,
      requested_quantity: data.quantity,
      urgency: data.urgency,
      notes: data.notes,
    });
    return mapTransfer(response.data);
  },

  updateStatus: async (id: string, status: TransferStatus, reason?: string): Promise<TransferRequest> => {
    const current = await transfersApi.getById(id);
    let response;
    if (status === 'approved') {
      response = await apiClient.post<BackendTransfer>(`/transfers/${id}/approve`, { approved_quantity: current.quantity });
    } else if (status === 'rejected') {
      response = await apiClient.post<BackendTransfer>(`/transfers/${id}/reject`, undefined, { params: { reason } });
    } else if (status === 'in_transit') {
      response = await apiClient.post<BackendTransfer>(`/transfers/${id}/dispatch`, { dispatched_quantity: current.approved_quantity || current.quantity });
    } else if (status === 'delivered') {
      response = await apiClient.post<BackendTransfer>(`/transfers/${id}/receive`, { received_quantity: current.dispatched_quantity || current.quantity });
    } else if (status === 'cancelled') {
      response = await apiClient.post<BackendTransfer>(`/transfers/${id}/cancel`, { reason });
    } else {
      throw new Error(`Unsupported transfer transition: ${status}`);
    }
    return mapTransfer(response.data);
  },
};
