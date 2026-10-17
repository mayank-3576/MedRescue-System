from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class MedicineBase(BaseModel):
    name: str
    generic_name: str
    dosage_form: str
    strength: str
    manufacturer: str
    category: str
    barcode: Optional[str] = None
    unit_price: float = Field(default=0, ge=0)
    min_stock_level: int = Field(default=0, ge=0)
    requires_cold_chain: bool = False


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, ge=0)
    min_stock_level: Optional[int] = Field(default=None, ge=0)
    requires_cold_chain: Optional[bool] = None


class MedicineResponse(MedicineBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MedicineWithStockResponse(MedicineResponse):
    total_available_stock: int = 0
    total_reserved_stock: int = 0
    active_batches_count: int = 0
    nearest_expiry_days: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
