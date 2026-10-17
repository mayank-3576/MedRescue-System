from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict


class AuditLogBase(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[Any] = None
    ip_address: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    user_id: Optional[int] = None


class AuditLogResponse(AuditLogBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
