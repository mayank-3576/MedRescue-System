from typing import List, Optional
from pydantic import BaseModel


class ExpiryRiskBreakdownItem(BaseModel):
    risk_level: str
    batch_count: int
    quantity: int
    total_value: float


class CategoryRiskItem(BaseModel):
    category: str
    total_batches: int
    at_risk_batches: int
    value_at_risk: float


class HospitalPerformanceItem(BaseModel):
    hospital_id: int
    hospital_name: str
    city: str
    total_inventory_value: float
    total_batches: int
    total_units: int
    value_at_risk: float
    outbound_transfers_count: int
    inbound_transfers_count: int
    rescued_value: float


class TransferStatusBreakdownItem(BaseModel):
    status: str
    count: int
    total_value: float


class TopExpiringMedicineItem(BaseModel):
    medicine_id: int
    medicine_name: str
    generic_name: str
    category: str
    expiring_batch_count: int
    total_units_at_risk: int
    total_value_at_risk: float
    earliest_expiry_days: int


class AnalyticsOverview(BaseModel):
    total_inventory_value: float
    total_value_at_risk: float
    total_rescued_value: float
    prevention_rate_percentage: float
    risk_breakdown: List[ExpiryRiskBreakdownItem]
    category_breakdown: List[CategoryRiskItem]
    hospital_performance: List[HospitalPerformanceItem]
    transfer_status_breakdown: List[TransferStatusBreakdownItem]
    top_expiring_medicines: List[TopExpiringMedicineItem]
