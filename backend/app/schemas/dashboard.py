from typing import List, Optional
from pydantic import BaseModel


class RiskDistributionItem(BaseModel):
    risk_level: str
    count: int
    total_value: float


class RecentTransferItem(BaseModel):
    id: int
    medicine_name: str
    source_hospital_name: str
    destination_hospital_name: str
    requested_quantity: int
    status: str
    created_at: str


class TopExpiringBatchItem(BaseModel):
    batch_id: int
    batch_number: str
    medicine_name: str
    hospital_name: str
    expiry_date: str
    days_remaining: int
    risk_level: str
    available_quantity: int
    value_at_risk: float


class DashboardSummary(BaseModel):
    total_medicines: int
    total_batches: int
    total_hospitals: int
    total_inventory_value: float
    value_at_risk: float  # batches expiring in <= 60 days
    critical_alerts_count: int
    high_alerts_count: int
    total_alerts_count: int
    pending_transfers_count: int
    completed_transfers_count: int
    rescued_value_total: float
    risk_distribution: List[RiskDistributionItem]
    recent_transfers: List[RecentTransferItem]
    top_expiring_batches: List[TopExpiringBatchItem]
