export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name?: string;
  hospital_id?: string;
  hospital_name?: string;
  phone?: string;
  created_at?: string;
  is_active?: boolean;
}

export type HospitalType = 'government' | 'private' | 'clinic';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  pmjay_hospital_id?: string;
  pmjay_verification_status?: 'unverified' | 'pending' | 'verified_manual' | 'rejected';
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  bed_capacity: number;
  type: HospitalType;
  is_active?: boolean;
  created_at?: string;
  total_inventory_count?: number;
  critical_alerts_count?: number;
}

export interface Medicine {
  id: string;
  barcode?: string;
  name: string;
  generic_name: string;
  category: string;
  dosage_form: string;
  strength: string;
  manufacturer: string;
  unit_price: number;
  unit_purchase_cost?: number;
  description?: string;
  min_stock_level: number;
  requires_cold_chain: boolean;
  created_at?: string;
}

export type BatchStatus = 'active' | 'expiring_soon' | 'expired' | 'transferred' | 'consumed';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface MedicineBatch {
  id: string;
  medicine_id: string;
  hospital_id: string;
  batch_number: string;
  quantity: number;
  initial_quantity?: number;
  unit_purchase_cost?: number;
  approved_quantity?: number;
  dispatched_quantity?: number;
  received_quantity?: number;
  reserved_quantity?: number;
  expiry_date: string; // ISO date string
  manufacturing_date: string;
  unit_price: number;
  status: BatchStatus;
  storage_condition?: string;
  medicine?: Medicine;
  hospital?: Hospital;
  days_to_expiry?: number;
  value_at_risk?: number;
  risk_level?: RiskLevel;
  created_at?: string;
}

export interface ExpiryAlert {
  id: string;
  batch_id: string;
  hospital_id: string;
  risk_level: RiskLevel;
  days_left: number;
  estimated_waste_cost: number;
  alert_date: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_reason?: string;
  medicine_name?: string;
  batch_number?: string;
  batch_quantity?: number;
  expiry_date?: string;
  hospital_name?: string;
  batch?: MedicineBatch;
  hospital?: Hospital;
}

export type TransferUrgency = 'routine' | 'urgent' | 'emergency';
export type TransferStatus = 'pending' | 'approved' | 'in_transit' | 'delivered' | 'rejected' | 'cancelled';

export interface TransferRequest {
  id: string;
  source_hospital_id: string;
  destination_hospital_id: string;
  medicine_id: string;
  batch_id: string;
  quantity: number;
  approved_quantity?: number;
  dispatched_quantity?: number;
  received_quantity?: number;
  urgency: TransferUrgency;
  status: TransferStatus;
  source_hospital?: Hospital;
  destination_hospital?: Hospital;
  medicine?: Medicine;
  source_hospital_name?: string;
  destination_hospital_name?: string;
  medicine_name?: string;
  batch_number?: string;
  batch?: MedicineBatch;
  requested_by?: string;
  approved_by?: string;
  tracking_code?: string;
  created_at: string;
  updated_at?: string;
  notes?: string;
  estimated_delivery_time?: string;
  estimated_cost?: number;
  distance_km?: number;
}

export interface DemandRecord {
  id: string;
  hospital_id: string;
  medicine_id: string;
  monthly_consumption: number;
  current_stock: number;
  projected_shortage: number;
  shortage_date: string;
  urgency_score?: number;
  hospital?: Hospital;
  medicine?: Medicine;
}

export interface DeliveryEstimate {
  distance_km: number;
  estimated_time_minutes: number;
  transport_mode: string;
  estimated_cost: number;
  is_road_distance: boolean;
  cost_per_km: number;
  fixed_charge: number;
  route_coordinates?: [number, number][];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
}

export interface DashboardStats {
  total_hospitals: number;
  total_medicines: number;
  active_batches: number;
  critical_alerts: number;
  high_risk_alerts: number;
  total_value_at_risk: number;
  saved_value: number;
  pending_transfers: number;
  completed_transfers: number;
}

export interface RescueRecommendation {
  id: string;
  batch_id: string;
  medicine_name: string;
  quantity: number;
  expiry_date: string;
  source_hospital_id: string;
  source_hospital_name: string;
  source_location: [number, number];
  target_hospital_id: string;
  target_hospital_name: string;
  target_location: [number, number];
  match_score: number; // 0 - 100
  demand_urgency: TransferUrgency;
  distance_km: number;
  estimated_delivery_cost: number;
  waste_savings: number;
  status: 'recommended' | 'transferred' | 'dismissed';
  reason: string;
}

export interface AnalyticsData {
  inventory_by_hospital: { hospital_name: string; count: number; value: number }[];
  expiry_risk_distribution: { name: string; value: number; color: string }[];
  transfers_by_status: { status: string; count: number }[];
  monthly_trends: { month: string; saved_value: number; expired_value: number }[];
  value_at_risk_trend: { date: string; value: number }[];
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggested_actions?: string[];
  data?: any;
  explanation?: string;
  explanation_provider?: string;
}

export interface AppSettings {
  cost_per_km: number;
  fixed_delivery_charge: number;
  min_shelf_life_days: number;
  max_delivery_radius_km: number;
}
