from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.validation import validate_batch_dates


class BatchBase(BaseModel):
    medicine_id: int
    hospital_id: int
    batch_number: str
    available_quantity: int = Field(ge=0)
    reserved_quantity: int = Field(default=0, ge=0)
    unit_mrp: float = Field(ge=0.0)
    unit_purchase_cost: float = Field(ge=0.0)
    manufacturing_date: date
    expiry_date: date
    storage_requirements: Optional[str] = "Store below 25°C in a dry place"
    status: str = "active"  # active, expired, recalled, quarantined, damaged
    is_demo: bool = False


class BatchCreate(BatchBase):
    @model_validator(mode="after")
    def validate_dates(self):
        validate_batch_dates(self.manufacturing_date, self.expiry_date)
        return self


class BatchUpdate(BaseModel):
    available_quantity: Optional[int] = Field(default=None, ge=0)
    reserved_quantity: Optional[int] = Field(default=None, ge=0)
    unit_mrp: Optional[float] = Field(default=None, ge=0.0)
    unit_purchase_cost: Optional[float] = Field(default=None, ge=0.0)
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_requirements: Optional[str] = None
    status: Optional[str] = None
    is_demo: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.manufacturing_date is not None and self.expiry_date is not None:
            validate_batch_dates(self.manufacturing_date, self.expiry_date)
        return self


class BatchResponse(BatchBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchWithDetailsResponse(BatchResponse):
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    category: Optional[str] = None
    hospital_name: Optional[str] = None
    hospital_city: Optional[str] = None
    days_to_expiry: Optional[int] = None
    risk_level: Optional[str] = None
    total_batch_value: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class FEFOBatchResponse(BaseModel):
    batch_id: int
    batch_number: str
    medicine_id: int
    medicine_name: str
    hospital_id: int
    hospital_name: str
    expiry_date: date
    days_remaining: int
    risk_level: str
    available_quantity: int
    allocated_quantity: int
    unit_mrp: float
    fefo_priority_rank: int

    model_config = ConfigDict(from_attributes=True)


class QuickScanAddRequest(BaseModel):
    barcode: str
    hospital_id: Optional[int] = None
    quantity: int = Field(default=50, ge=1)
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    unit_mrp: Optional[float] = None
    unit_purchase_cost: Optional[float] = None
    storage_requirements: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.manufacturing_date is not None and self.expiry_date is not None:
            validate_batch_dates(self.manufacturing_date, self.expiry_date)
        return self


class QuickScanAddResponse(BaseModel):
    success: bool
    message: str
    medicine_id: int
    medicine_name: str
    generic_name: str
    strength: str
    barcode: str
    batch_id: int
    batch_number: str
    added_quantity: int
    available_quantity: int
    expiry_date: date
    days_to_expiry: int
    risk_level: str
    hospital_id: int
    hospital_name: str
    is_newly_registered_medicine: bool = False

