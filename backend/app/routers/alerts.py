from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import ExpiryAlert
from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.alert import AlertUpdate, AlertResponse, AlertWithDetailsResponse, AlertSummary
from app.auth.security import get_current_active_user
from app.auth.permissions import verify_hospital_access
from app.services.expiry_service import refresh_all_alerts
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/alerts", tags=["Expiry Alerts"])


@router.get("", response_model=List[AlertWithDetailsResponse])
def list_alerts(
    risk_level: Optional[str] = None,
    alert_status: Optional[str] = Query("active", alias="status"),
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List expiry alerts filtered by risk classification and status.
    Enforces hospital data isolation for staff accounts.
    """
    query = (
        db.query(ExpiryAlert)
        .join(MedicineBatch, ExpiryAlert.batch_id == MedicineBatch.id)
        .join(Medicine, ExpiryAlert.medicine_id == Medicine.id)
        .join(Hospital, ExpiryAlert.hospital_id == Hospital.id)
    )

    if current_user.role == "staff":
        query = query.filter(ExpiryAlert.hospital_id == current_user.hospital_id)
    elif hospital_id is not None:
        query = query.filter(ExpiryAlert.hospital_id == hospital_id)

    if risk_level:
        query = query.filter(ExpiryAlert.risk_level == risk_level.lower())
    if alert_status:
        query = query.filter(ExpiryAlert.alert_status == alert_status.lower())
    if medicine_id is not None:
        query = query.filter(ExpiryAlert.medicine_id == medicine_id)

    alerts = query.order_by(ExpiryAlert.days_remaining.asc()).offset(skip).limit(limit).all()

    results = []
    for a in alerts:
        batch = a.batch
        med = a.medicine
        hosp = a.hospital
        val_at_risk = round(batch.available_quantity * batch.unit_mrp, 2) if batch else 0.0

        results.append(AlertWithDetailsResponse(
            id=a.id,
            batch_id=a.batch_id,
            hospital_id=a.hospital_id,
            medicine_id=a.medicine_id,
            risk_level=a.risk_level,
            days_remaining=a.days_remaining,
            alert_status=a.alert_status,
            created_at=a.created_at,
            updated_at=a.updated_at,
            medicine_name=med.name if med else None,
            generic_name=med.generic_name if med else None,
            dosage_form=med.dosage_form if med else None,
            strength=med.strength if med else None,
            batch_number=batch.batch_number if batch else None,
            expiry_date=batch.expiry_date if batch else None,
            available_quantity=batch.available_quantity if batch else 0,
            unit_mrp=batch.unit_mrp if batch else 0.0,
            value_at_risk=val_at_risk,
            hospital_name=hosp.name if hosp else None,
            hospital_city=hosp.city if hosp else None,
        ))

    return results


@router.get("/summary", response_model=AlertSummary)
def get_alert_summary(
    hospital_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Aggregate alert counts and value at risk by urgency tier."""
    query = (
        db.query(ExpiryAlert)
        .join(MedicineBatch, ExpiryAlert.batch_id == MedicineBatch.id)
        .filter(ExpiryAlert.alert_status == "active")
    )

    if current_user.role == "staff":
        query = query.filter(ExpiryAlert.hospital_id == current_user.hospital_id)
    elif hospital_id is not None:
        query = query.filter(ExpiryAlert.hospital_id == hospital_id)

    alerts = query.all()

    critical_c = 0
    high_c = 0
    medium_c = 0
    low_c = 0
    expired_c = 0
    total_val = 0.0

    for a in alerts:
        val = (a.batch.available_quantity * a.batch.unit_mrp) if a.batch else 0.0
        total_val += val
        if a.risk_level == "critical":
            critical_c += 1
        elif a.risk_level == "high":
            high_c += 1
        elif a.risk_level == "medium":
            medium_c += 1
        elif a.risk_level == "low":
            low_c += 1
        elif a.risk_level == "expired":
            expired_c += 1

    return AlertSummary(
        total_alerts=len(alerts),
        critical_count=critical_c,
        high_count=high_c,
        medium_count=medium_c,
        low_count=low_c,
        expired_count=expired_c,
        total_value_at_risk=round(total_val, 2),
    )


@router.put("/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: int,
    update_data: AlertUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update alert status (e.g. acknowledge or resolve)."""
    alert = db.query(ExpiryAlert).filter(ExpiryAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    verify_hospital_access(alert.hospital_id, current_user)

    if update_data.alert_status:
        alert.alert_status = update_data.alert_status
    if update_data.risk_level:
        alert.risk_level = update_data.risk_level

    db.add(alert)
    db.commit()
    db.refresh(alert)

    log_audit_event(
        db=db,
        action="UPDATE_ALERT",
        entity_type="alert",
        entity_id=alert.id,
        user_id=current_user.id,
        details={"status": alert.alert_status, "risk": alert.risk_level}
    )

    return alert


@router.post("/refresh")
def refresh_alerts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Trigger system-wide re-evaluation of expiry alerts."""
    hosp_filter = current_user.hospital_id if current_user.role == "staff" else None
    updated_count = refresh_all_alerts(db, hospital_id=hosp_filter)

    log_audit_event(
        db=db,
        action="REFRESH_ALERTS",
        entity_type="alert",
        user_id=current_user.id,
        details={"alerts_processed": updated_count}
    )

    return {"message": f"Successfully evaluated and refreshed alerts.", "alerts_processed": updated_count}
