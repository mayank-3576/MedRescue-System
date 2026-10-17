from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class DemandBase(BaseModel):
    hospital_id: int
    medicine_id: int
    required_quantity: int = Field(gt=0)
    priority: str = "medium"  # critical, high, medium, low
    notes: Optional[str] = None
    demand_date: date = Field(default_factory=date.today)
    is_active: bool = True


class DemandCreate(DemandBase):
    @field_validator("demand_date")
    @classmethod
    def demand_date_not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Demand observation date cannot be in the future")
        return value


class DemandUpdate(BaseModel):
    required_quantity: Optional[int] = Field(default=None, gt=0)
    priority: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DemandResponse(DemandBase):
    id: int
    original_quantity: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DemandWithDetailsResponse(DemandResponse):
    hospital_name: Optional[str] = None
    hospital_city: Optional[str] = None
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    category: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
