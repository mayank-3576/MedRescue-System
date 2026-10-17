from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.auth.security import get_current_active_user
from app.services.dashboard_service import get_dashboard_summary

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard(
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve operational summary KPIs, inventory valuation, risk distribution,
    and recent activity. Staff users automatically view metrics for their hospital.
    """
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    summary = get_dashboard_summary(db=db, hospital_id=hosp_filter)
    return summary
