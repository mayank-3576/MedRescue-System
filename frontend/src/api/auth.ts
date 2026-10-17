import apiClient from './client';
import { User } from '../types';

interface BackendUser {
  id: number | string;
  email: string;
  full_name: string;
  role: User['role'];
  hospital_id?: number | string | null;
  hospital_name?: string | null;
  hospital_city?: string | null;
  is_active?: boolean;
  created_at?: string;
}

interface BackendToken {
  access_token: string;
  user: BackendUser;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegistrationHospital {
  id: number;
  name: string;
  city: string;
  state: string;
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

export const authApi = {
  getRegistrationHospitals: async (): Promise<RegistrationHospital[]> =>
    (await apiClient.get<RegistrationHospital[]>('/auth/registration-hospitals')).data,

  registerHospitalStaff: async (form: FormData): Promise<{ application_id: number; status: string; message: string }> =>
    (await apiClient.post('/auth/register-staff', form)).data,

  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<BackendToken>('/auth/login-json', { email, password });
    return { token: response.data.access_token, user: mapUser(response.data.user) };
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<BackendUser>('/auth/me');
    return mapUser(response.data);
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('medrescue_token');
      localStorage.removeItem('medrescue_user');
    }
  },
};
