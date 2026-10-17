from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class RouteCoordinate(BaseModel):
    latitude: float
    longitude: float


class RouteCalculationRequest(BaseModel):
    source_hospital_id: int
    destination_hospital_id: int


class RouteCalculationResponse(BaseModel):
    source_hospital_id: int
    destination_hospital_id: int
    source_hospital_name: str
    destination_hospital_name: str
    distance_km: float
    estimated_duration_hours: float
    is_road_distance: bool
    cost_per_km: float
    fixed_charge: float
    estimated_cost: float
    route_geometry: Optional[List[List[float]]] = None  # coordinates [[lon, lat], ...]


class DeliveryEstimateCreate(BaseModel):
    source_hospital_id: int
    destination_hospital_id: int
    transfer_id: Optional[int] = None
    distance_km: float
    is_road_distance: bool
    cost_per_km: float
    fixed_charge: float
    estimated_cost: float


class DeliveryEstimateResponse(DeliveryEstimateCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
