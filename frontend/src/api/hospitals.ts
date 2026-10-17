import apiClient from './client';
import { Hospital, HospitalType } from '../types';

interface BackendHospital {
  id: number | string;
  name: string;
  code?: string | null;
  pmjay_hospital_id?: string | null;
  pmjay_verification_status?: Hospital['pmjay_verification_status'];
  address: string;
  city: string;
  state: string;
  pincode?: string | null;
  bed_capacity?: number;
  hospital_type?: HospitalType;
  latitude: number;
  longitude: number;
  is_active: boolean;
  contact_phone?: string | null;
  contact_email?: string | null;
  created_at?: string;
  total_inventory_value?: number;
  active_alerts_count?: number;
}

export interface GovIdVerificationResult {
  is_valid: boolean;
  gov_hospital_id: string;
  status: string;
  registered_facility_name?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bed_capacity?: number;
  facility_type?: string;
  registry_authority?: string;
  accreditation?: string;
  nodal_officer?: string;
  authorized_to_operate: boolean;
  verification_certificate?: string;
  verified_at?: string;
  message: string;
}

const mapHospital = (hospital: BackendHospital): Hospital => ({
  id: String(hospital.id),
  name: hospital.name,
  code: hospital.code || `H-${hospital.id}`,
  pmjay_hospital_id: hospital.pmjay_hospital_id || undefined,
  pmjay_verification_status: hospital.pmjay_verification_status || 'unverified',
  address: hospital.address,
  city: hospital.city,
  state: hospital.state,
  pincode: hospital.pincode || '',
  latitude: hospital.latitude,
  longitude: hospital.longitude,
  phone: hospital.contact_phone || '',
  email: hospital.contact_email || '',
  bed_capacity: hospital.bed_capacity ?? 0,
  type: hospital.hospital_type ?? 'government',
  is_active: hospital.is_active,
  created_at: hospital.created_at,
  critical_alerts_count: hospital.active_alerts_count,
});

const toBackend = (data: Partial<Hospital>) => ({
  name: data.name,
  code: data.code,
  pmjay_hospital_id: data.pmjay_hospital_id?.trim() || undefined,
  address: data.address,
  city: data.city,
  state: data.state,
  pincode: data.pincode,
  bed_capacity: data.bed_capacity,
  hospital_type: data.type,
  latitude: data.latitude,
  longitude: data.longitude,
  is_active: data.is_active,
  contact_phone: data.phone,
  contact_email: data.email,
});

export const hospitalsApi = {
  getAll: async (params?: { search?: string; type?: string; city?: string; is_active?: boolean }): Promise<Hospital[]> => {
    const response = await apiClient.get<BackendHospital[]>('/hospitals', { params: { city: params?.city, is_active: params?.is_active } });
    let hospitals = response.data.map(mapHospital);
    if (params?.search) {
      const search = params.search.toLowerCase();
      hospitals = hospitals.filter((hospital) =>
        [hospital.name, hospital.code, hospital.city].some((value) => value.toLowerCase().includes(search))
      );
    }
    if (params?.type && params.type !== 'all') hospitals = hospitals.filter((hospital) => hospital.type === params.type);
    return hospitals;
  },

  getById: async (id: string): Promise<Hospital> => {
    const response = await apiClient.get<BackendHospital>(`/hospitals/${id}`);
    return mapHospital(response.data);
  },

  verifyGovId: async (data: { gov_hospital_id: string; hospital_name?: string; city?: string; state?: string }): Promise<GovIdVerificationResult> => {
    const response = await apiClient.post<GovIdVerificationResult>('/hospitals/verify-gov-id', data);
    return response.data;
  },

  create: async (data: Omit<Hospital, 'id'>): Promise<Hospital> => {
    const response = await apiClient.post<BackendHospital>('/hospitals', toBackend(data));
    return mapHospital(response.data);
  },

  update: async (id: string, data: Partial<Hospital>): Promise<Hospital> => {
    const response = await apiClient.put<BackendHospital>(`/hospitals/${id}`, toBackend(data));
    return mapHospital(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/hospitals/${id}`);
  },

  confirmPMJAYVerification: async (id: string, confirmed: boolean): Promise<Hospital> => {
    const response = await apiClient.post<BackendHospital>(`/hospitals/${id}/pmjay-verification`, { confirmed });
    return mapHospital(response.data);
  },
};
