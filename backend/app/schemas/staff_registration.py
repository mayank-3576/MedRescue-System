from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class RegistrationHospitalResponse(BaseModel):
    id: int
    name: str
    city: str
    state: str


class StaffRegistrationResponse(BaseModel):
    id: int
    full_name: str
    email: str
    hospital_id: int
    hospital_name: str
    hospital_city: str
    government_id_type: str
    status: str
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None
    government_id_verified: bool
    hospital_authorization_verified: bool
    government_id_document_viewed: bool
    authorization_document_viewed: bool
    government_id_document_available: bool
    authorization_document_available: bool


class StaffRegistrationDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    review_note: Optional[str] = Field(default=None, max_length=500)
    government_id_verified: bool = False
    hospital_authorization_verified: bool = False

    @model_validator(mode="after")
    def rejection_needs_reason(self):
        if self.decision == "rejected" and not (self.review_note or "").strip():
            raise ValueError("Add a reason when rejecting an account request")
        if self.decision == "approved" and not (self.government_id_verified and self.hospital_authorization_verified):
            raise ValueError("Verify both the government ID and hospital authorization before approving")
        return self
