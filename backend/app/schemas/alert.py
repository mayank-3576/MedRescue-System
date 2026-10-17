from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AlertBase(BaseModel):
    batch_id: int
    hospital_id: int
    medicine_id: int
    risk_level: str  # critical, high, medium, low, normal, expired
    days_remaining: int
    alert_status: str = "active"  # active, acknowledged, resolved


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    alert_status: Optional[str] = None  # active, acknowledged, resolved
    risk_level: Optional[str] = None


class AlertResponse(AlertBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertWithDetailsResponse(AlertResponse):
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    available_quantity: Optional[int] = None
    unit_mrp: Optional[float] = None
    value_at_risk: Optional[float] = None
    hospital_name: Optional[str] = None
    hospital_city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AlertSummary(BaseModel):
    total_alerts: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    expired_count: int = 0
    total_value_at_risk: float = 0.0
