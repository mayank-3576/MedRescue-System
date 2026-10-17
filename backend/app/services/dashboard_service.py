from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.medicine import Medicine
from app.models.batch import MedicineBatch
from app.models.hospital import Hospital
from app.models.alert import ExpiryAlert
from app.models.transfer import TransferRequest
from app.services.expiry_service import calculate_days_remaining, determine_risk_level


def get_dashboard_summary(db: Session, hospital_id: Optional[int] = None) -> Dict[str, Any]:
    """Compile aggregated KPIs and real-time operational metrics for dashboard visualization."""
    today = date.today()

    # Total medicines count
    total_medicines = db.query(func.count(Medicine.id)).scalar() or 0

    # Total active hospitals count
    total_hospitals = db.query(func.count(Hospital.id)).filter(Hospital.is_active == True).scalar() or 0

    # Batches query
    batches_q = db.query(MedicineBatch).filter(MedicineBatch.status == "active")
    if hospital_id is not None:
        batches_q = batches_q.filter(MedicineBatch.hospital_id == hospital_id)
    batches = batches_q.all()

    total_batches = len(batches)
    total_inventory_value = 0.0
    value_at_risk_60d = 0.0

    risk_stats = {
        "critical": {"count": 0, "value": 0.0},
        "high": {"count": 0, "value": 0.0},
        "medium": {"count": 0, "value": 0.0},
        "low": {"count": 0, "value": 0.0},
        "normal": {"count": 0, "value": 0.0},
        "expired": {"count": 0, "value": 0.0},
    }

    top_expiring_list = []

    for b in batches:
        val = b.available_quantity * b.unit_mrp
        total_inventory_value += val
        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)

        risk_stats[risk]["count"] += 1
        risk_stats[risk]["value"] += val

        if days <= 60:
            value_at_risk_60d += val

        if b.available_quantity > 0:
            top_expiring_list.append({
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "medicine_name": b.medicine.name if b.medicine else "Unknown",
                "hospital_name": b.hospital.name if b.hospital else "Unknown",
                "expiry_date": str(b.expiry_date),
                "days_remaining": days,
                "risk_level": risk,
                "available_quantity": b.available_quantity,
                "value_at_risk": round(val, 2),
            })

    # Sort top expiring by days remaining ascending
    top_expiring_list.sort(key=lambda x: x["days_remaining"])
    top_expiring = top_expiring_list[:6]

    # Alerts query
    alerts_q = db.query(ExpiryAlert).filter(ExpiryAlert.alert_status == "active")
    if hospital_id is not None:
        alerts_q = alerts_q.filter(ExpiryAlert.hospital_id == hospital_id)

    alerts = alerts_q.all()
    critical_alerts_count = sum(1 for a in alerts if a.risk_level == "critical")
    high_alerts_count = sum(1 for a in alerts if a.risk_level == "high")
    total_alerts_count = len(alerts)

    # Transfers query
    transfers_q = db.query(TransferRequest)
    if hospital_id is not None:
        transfers_q = transfers_q.filter(
            (TransferRequest.source_hospital_id == hospital_id) |
            (TransferRequest.destination_hospital_id == hospital_id)
        )

    all_transfers = transfers_q.all()
    pending_transfers_count = sum(1 for t in all_transfers if t.status in ["draft", "pending_approval", "approved", "dispatched"])
    completed_transfers_count = sum(1 for t in all_transfers if t.status == "received")

    # Rescued value calculation (value of transferred & received batches)
    rescued_value_total = 0.0
    for t in all_transfers:
        if t.status == "received" and t.batch:
            rescued_value_total += (t.received_quantity * t.batch.unit_mrp)

    # Recent transfers
    recent_transfers_q = (
        db.query(TransferRequest)
        .order_by(desc(TransferRequest.created_at))
    )
    if hospital_id is not None:
        recent_transfers_q = recent_transfers_q.filter(
            (TransferRequest.source_hospital_id == hospital_id) |
            (TransferRequest.destination_hospital_id == hospital_id)
        )
    recent_transfers_entities = recent_transfers_q.limit(5).all()

    recent_transfers = []
    for t in recent_transfers_entities:
        recent_transfers.append({
            "id": t.id,
            "medicine_name": t.medicine.name if t.medicine else "Unknown",
            "source_hospital_name": t.source_hospital.name if t.source_hospital else "Unknown",
            "destination_hospital_name": t.destination_hospital.name if t.destination_hospital else "Unknown",
            "requested_quantity": t.requested_quantity,
            "status": t.status,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    risk_distribution = [
        {"risk_level": r, "count": d["count"], "total_value": round(d["value"], 2)}
        for r, d in risk_stats.items()
    ]

    return {
        "total_medicines": total_medicines,
        "total_batches": total_batches,
        "total_hospitals": total_hospitals,
        "total_inventory_value": round(total_inventory_value, 2),
        "value_at_risk": round(value_at_risk_60d, 2),
        "critical_alerts_count": critical_alerts_count,
        "high_alerts_count": high_alerts_count,
        "total_alerts_count": total_alerts_count,
        "pending_transfers_count": pending_transfers_count,
        "completed_transfers_count": completed_transfers_count,
        "rescued_value_total": round(rescued_value_total, 2),
        "risk_distribution": risk_distribution,
        "recent_transfers": recent_transfers,
        "top_expiring_batches": top_expiring,
    }
