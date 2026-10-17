from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class HospitalBase(BaseModel):
    name: str
    code: Optional[str] = None
    pmjay_hospital_id: Optional[str] = None
    pmjay_verification_status: str = "unverified"
    pmjay_verified_at: Optional[datetime] = None
    pmjay_verified_by: Optional[int] = None
    address: str
    city: str
    state: str
    pincode: Optional[str] = None
    bed_capacity: int = 0
    hospital_type: str = "government"
    latitude: float
    longitude: float
    is_active: bool = True
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class HospitalCreate(HospitalBase):
    pass


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    pmjay_hospital_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    bed_capacity: Optional[int] = None
    hospital_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class HospitalResponse(HospitalBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HospitalDetailResponse(HospitalResponse):
    active_batches_count: int = 0
    active_alerts_count: int = 0
    pending_demands_count: int = 0
    total_inventory_value: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class HospitalGeoFeature(BaseModel):
    id: int
    name: str
    city: str
    state: str
    latitude: float
    longitude: float
    active_alerts_count: int = 0
    critical_alerts_count: int = 0
    total_batches: int = 0
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class PMJAYVerificationConfirmation(BaseModel):
    confirmed: bool
    notes: Optional[str] = None


class GovHospitalIdVerifyRequest(BaseModel):
    gov_hospital_id: str
    hospital_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class GovHospitalIdVerifyResponse(BaseModel):
    is_valid: bool
    gov_hospital_id: str
    status: str
    registered_facility_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    bed_capacity: Optional[int] = None
    facility_type: Optional[str] = None
    registry_authority: Optional[str] = None
    accreditation: Optional[str] = None
    nodal_officer: Optional[str] = None
    authorized_to_operate: bool = False
    verification_certificate: Optional[str] = None
    verified_at: Optional[str] = None
    message: str
