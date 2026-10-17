from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.services.quantity_forecast_service import predict_quantity, predict_hospital_summary

router = APIRouter(prefix="/api/forecasts", tags=["Quantity Forecasts"])


@router.get("/quantity")
def forecast_quantity(
    medicine_id: int = Query(..., gt=0),
    hospital_id: Optional[int] = Query(None, gt=0),
    horizon_days: int = Query(30, ge=7, le=90),
    season: Optional[str] = Query(None, description="monsoon, winter, summer, post_monsoon"),
    temperature: Optional[float] = Query(None, ge=-10.0, le=60.0),
    humidity: Optional[float] = Query(None, ge=0.0, le=100.0),
    aqi: Optional[int] = Query(None, ge=0, le=999),
    outbreak_risk: Optional[str] = Query(None, description="none, moderate, high, critical"),
    provider: str = Query("rules", description="rules, openai, anthropic"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Predictable AI endpoint:
    Calculates future medicine requirements adjusted by environmental variables
    (Season, Ambient Temperature, Humidity, AQI, Outbreak Risk) with Explainable AI.
    """
    target_hospital = current_user.hospital_id if current_user.role == "staff" else hospital_id
    if target_hospital is None:
        raise HTTPException(status_code=400, detail="hospital_id is required for admin forecasts")
    active_hospital = db.query(Hospital.id).filter(Hospital.id == target_hospital, Hospital.is_active.is_(True)).first()
    if not active_hospital:
        raise HTTPException(status_code=409, detail="Hospital must be verified and active before forecasting")
    try:
        return predict_quantity(
            db=db,
            hospital_id=target_hospital,
            medicine_id=medicine_id,
            horizon_days=horizon_days,
            season=season,
            temperature=temperature,
            humidity=humidity,
            aqi=aqi,
            outbreak_risk=outbreak_risk,
            explainer_provider=provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/hospital-summary")
def forecast_hospital_summary(
    hospital_id: Optional[int] = Query(None, gt=0),
    horizon_days: int = Query(30, ge=7, le=90),
    season: Optional[str] = Query(None, description="monsoon, winter, summer, post_monsoon"),
    temperature: Optional[float] = Query(None, ge=-10.0, le=60.0),
    humidity: Optional[float] = Query(None, ge=0.0, le=100.0),
    aqi: Optional[int] = Query(None, ge=0, le=999),
    outbreak_risk: Optional[str] = Query(None, description="none, moderate, high, critical"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Predictable AI Hospital Environmental Demand Portfolio:
    Computes climate-modeled medicine consumption, deficit gap, and stockout urgency
    across all catalog formulations for the target facility.
    """
    target_hospital = current_user.hospital_id if current_user.role == "staff" else hospital_id
    if target_hospital is None:
        # Default to first active hospital if admin doesn't provide one
        first_h = db.query(Hospital).filter(Hospital.is_active.is_(True)).first()
        if not first_h:
            raise HTTPException(status_code=400, detail="No active hospital registered in system")
        target_hospital = first_h.id

    active_hospital = db.query(Hospital.id).filter(Hospital.id == target_hospital, Hospital.is_active.is_(True)).first()
    if not active_hospital:
        raise HTTPException(status_code=409, detail="Hospital must be verified and active before forecasting")

    try:
        return predict_hospital_summary(
            db=db,
            hospital_id=target_hospital,
            horizon_days=horizon_days,
            season=season,
            temperature=temperature,
            humidity=humidity,
            aqi=aqi,
            outbreak_risk=outbreak_risk,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

