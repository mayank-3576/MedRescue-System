from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, ConfigDict


class SettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    category: str = "general"


class SettingCreate(SettingBase):
    pass


class SettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None
    category: Optional[str] = None


class SettingsBulkUpdate(BaseModel):
    values: Dict[str, str]


class SettingResponse(SettingBase):
    id: int
    updated_by: Optional[int] = None
    updated_at: datetime
    updated_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
