from datetime import date, datetime
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session

from app.models.batch import MedicineBatch
from app.models.alert import ExpiryAlert


def calculate_days_remaining(expiry_date: date) -> int:
    """Calculate the number of days between today and the expiry date."""
    today = date.today()
    delta = expiry_date - today
    return delta.days


def determine_risk_level(days_remaining: int) -> str:
    """
    Determine the expiry risk classification based on remaining shelf life:
    - expired: days_remaining <= 0
    - critical: 1 to 7 days
    - high: 8 to 30 days
    - medium: 31 to 60 days
    - low: 61 to 90 days
    - normal: > 90 days
    """
    if days_remaining <= 0:
        return "expired"
    elif days_remaining <= 7:
        return "critical"
    elif days_remaining <= 30:
        return "high"
    elif days_remaining <= 60:
        return "medium"
    elif days_remaining <= 90:
        return "low"
    else:
        return "normal"


def get_batch_risk(batch: MedicineBatch) -> Tuple[int, str]:
    """Return days remaining and risk level for a given medicine batch."""
    days = calculate_days_remaining(batch.expiry_date)
    risk = determine_risk_level(days)
    return days, risk


def sync_batch_alert(db: Session, batch: MedicineBatch) -> Optional[ExpiryAlert]:
    """
    Synchronize expiry alert record for a specific batch based on current date.
    Updates batch status to 'expired' if days_remaining <= 0 and currently 'active'.
    """
    days_remaining, risk_level = get_batch_risk(batch)

    # Auto-update batch status if expired
    if days_remaining <= 0 and batch.status == "active":
        batch.status = "expired"
        db.add(batch)

    # Search for existing alert for this batch
    existing_alert = (
        db.query(ExpiryAlert)
        .filter(ExpiryAlert.batch_id == batch.id)
        .first()
    )

    if risk_level in ["expired", "critical", "high", "medium", "low"]:
        if existing_alert:
            existing_alert.days_remaining = days_remaining
            existing_alert.risk_level = risk_level
            # If it was resolved but now still at risk (e.g., date changed), reactivate
            if existing_alert.alert_status == "resolved" and days_remaining > 0:
                existing_alert.alert_status = "active"
            existing_alert.updated_at = datetime.utcnow()
            db.add(existing_alert)
            return existing_alert
        else:
            new_alert = ExpiryAlert(
                batch_id=batch.id,
                hospital_id=batch.hospital_id,
                medicine_id=batch.medicine_id,
                risk_level=risk_level,
                days_remaining=days_remaining,
                alert_status="active",
            )
            db.add(new_alert)
            return new_alert
    else:
        # Normal (> 90 days)
        if existing_alert and existing_alert.alert_status == "active":
            existing_alert.alert_status = "resolved"
            existing_alert.days_remaining = days_remaining
            existing_alert.risk_level = risk_level
            existing_alert.updated_at = datetime.utcnow()
            db.add(existing_alert)
            return existing_alert
        return None


def refresh_all_alerts(db: Session, hospital_id: Optional[int] = None) -> int:
    """
    Scan all active or expiring batches in the database and synchronize alerts.
    Returns count of updated alerts.
    """
    query = db.query(MedicineBatch)
    if hospital_id is not None:
        query = query.filter(MedicineBatch.hospital_id == hospital_id)

    batches = query.all()
    count = 0
    for batch in batches:
        alert = sync_batch_alert(db, batch)
        if alert:
            count += 1

    db.commit()
    return count
