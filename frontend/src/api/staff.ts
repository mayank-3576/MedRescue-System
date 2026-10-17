import apiClient from './client';
import { User } from '../types';

export interface StaffRegistrationRequest {
  id: number;
  full_name: string;
  email: string;
  hospital_id: number;
  hospital_name: string;
  hospital_city: string;
  government_id_type: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  government_id_verified: boolean;
  hospital_authorization_verified: boolean;
  government_id_document_viewed: boolean;
  authorization_document_viewed: boolean;
  government_id_document_available: boolean;
  authorization_document_available: boolean;
}

interface BackendUser {
  id: number | string;
  email: string;
  full_name: string;
  role: User['role'];
  hospital_id?: number | string | null;
  hospital_name?: string | null;
  is_active: boolean;
  created_at?: string;
}

const mapUser = (user: BackendUser): User => ({
  id: String(user.id),
  username: user.email,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  hospital_id: user.hospital_id == null ? undefined : String(user.hospital_id),
  hospital_name: user.hospital_name ?? undefined,
  is_active: user.is_active,
  created_at: user.created_at,
});

export const staffApi = {
  getRegistrationRequests: async (): Promise<StaffRegistrationRequest[]> =>
    (await apiClient.get<StaffRegistrationRequest[]>('/staff/registration-requests')).data,

  getRegistrationDocument: async (id: number, kind: 'government-id' | 'hospital-authorization'): Promise<Blob> =>
    (await apiClient.get(`/staff/registration-requests/${id}/documents/${kind}`, { responseType: 'blob' })).data,

  decideRegistration: async (id: number, decision: 'approved' | 'rejected', review_note: string, government_id_verified = false, hospital_authorization_verified = false) =>
    (await apiClient.post<StaffRegistrationRequest>(`/staff/registration-requests/${id}/decision`, {
      decision, review_note, government_id_verified, hospital_authorization_verified,
    })).data,

  getAll: async (params?: { hospital_id?: string; search?: string }): Promise<User[]> => {
    const response = await apiClient.get<BackendUser[]>('/staff', {
      params: { hospital_id: params?.hospital_id, role: 'staff' },
    });
    let users = response.data.map(mapUser);
    if (params?.search) {
      const query = params.search.toLowerCase();
      users = users.filter((user) => `${user.full_name} ${user.email}`.toLowerCase().includes(query));
    }
    return users;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<BackendUser>(`/staff/${id}`);
    return mapUser(response.data);
  },

  create: async (data: Partial<User> & { password: string }): Promise<User> => {
    const response = await apiClient.post<BackendUser>('/staff', {
      email: data.email,
      full_name: data.full_name,
      role: 'staff',
      hospital_id: data.hospital_id,
      password: data.password,
      is_active: true,
    });
    return mapUser(response.data);
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await apiClient.put<BackendUser>(`/staff/${id}`, {
      email: data.email,
      full_name: data.full_name,
      role: 'staff',
      hospital_id: data.hospital_id,
      is_active: data.is_active,
    });
    return mapUser(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/staff/${id}`);
  },
};
