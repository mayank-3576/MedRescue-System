from typing import List, Optional
from pydantic import BaseModel


class RescueRecommendationItem(BaseModel):
    batch_id: int
    batch_number: str
    medicine_id: int
    medicine_name: str
    generic_name: str
    category: str
    source_hospital_id: int
    source_hospital_name: str
    source_hospital_city: str
    destination_hospital_id: int
    destination_hospital_name: str
    destination_hospital_city: str
    source_latitude: float
    source_longitude: float
    destination_latitude: float
    destination_longitude: float
    expiry_date: str
    days_to_expiry: int
    risk_level: str
    available_quantity: int
    recommended_transfer_quantity: int
    unit_mrp: float
    total_batch_value: float
    estimated_distance_km: float
    is_road_distance: bool
    estimated_delivery_cost: float
    net_value_saved: float
    feasibility_score: float  # 0 to 100
    demand_priority: str
    urgency_score: float      # 0 to 100
    recommendation_rank: int
    rationale: str


class RescueEngineRunResponse(BaseModel):
    total_evaluated_batches: int
    total_at_risk_identified: int
    total_eligible_batches: int
    total_recommendations_generated: int
    total_potential_value_saved: float
    recommendations: List[RescueRecommendationItem]
