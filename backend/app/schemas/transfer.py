from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class TransferBase(BaseModel):
    source_hospital_id: int
    destination_hospital_id: int
    batch_id: int
    medicine_id: int
    requested_quantity: int = Field(gt=0)
    urgency: Literal["routine", "urgent", "emergency"] = "routine"
    notes: Optional[str] = None


class TransferCreate(TransferBase):
    pass


class TransferUpdate(BaseModel):
    requested_quantity: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class TransferApprove(BaseModel):
    approved_quantity: int = Field(gt=0)
    notes: Optional[str] = None


class TransferDispatch(BaseModel):
    dispatched_quantity: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class TransferReceive(BaseModel):
    received_quantity: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class TransferCancel(BaseModel):
    reason: Optional[str] = None


class TransferResponse(TransferBase):
    id: int
    approved_quantity: int = 0
    dispatched_quantity: int = 0
    received_quantity: int = 0
    status: str
    route_distance_km: Optional[float] = None
    delivery_cost: Optional[float] = None
    is_road_distance: bool = False
    requested_by: Optional[int] = None
    approved_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransferDetailResponse(TransferResponse):
    source_hospital_name: Optional[str] = None
    source_hospital_city: Optional[str] = None
    destination_hospital_name: Optional[str] = None
    destination_hospital_city: Optional[str] = None
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    batch_number: Optional[str] = None
    unit_mrp: Optional[float] = None
    total_transfer_value: Optional[float] = None
    requester_name: Optional[str] = None
    approver_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
