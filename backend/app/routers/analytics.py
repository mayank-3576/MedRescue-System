from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsOverview
from app.auth.security import get_current_active_user
from app.services.analytics_service import (
    get_analytics_overview,
    export_alerts_csv,
    export_transfers_csv,
    export_batches_csv,
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Reports"])


@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics(
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve deep analytics on expiry risk distribution, category vulnerability,
    hospital transfer balance, and top at-risk medicines.
    """
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    overview = get_analytics_overview(db=db, hospital_id=hosp_filter)
    return overview


@router.get("/export/alerts")
def download_alerts_csv(
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Export expiry alerts to a CSV spreadsheet."""
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    csv_data = export_alerts_csv(db=db, hospital_id=hosp_filter)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medrescue_expiry_alerts.csv"}
    )


@router.get("/export/transfers")
def download_transfers_csv(
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Export transfer requests to a CSV spreadsheet."""
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    csv_data = export_transfers_csv(db=db, hospital_id=hosp_filter)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medrescue_transfers.csv"}
    )


@router.get("/export/batches")
def download_batches_csv(
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Export medicine batches to a CSV spreadsheet."""
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    csv_data = export_batches_csv(db=db, hospital_id=hosp_filter)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medrescue_batches.csv"}
    )
