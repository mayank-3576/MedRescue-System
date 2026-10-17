from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.services.expiry_service import calculate_days_remaining, determine_risk_level


def get_inventory_summary(db: Session, hospital_id: Optional[int] = None) -> Dict[str, Any]:
    """Calculate aggregated inventory metrics, stock valuation, and value at risk."""
    today = date.today()

    batch_query = db.query(MedicineBatch).filter(MedicineBatch.status == "active")
    if hospital_id is not None:
        batch_query = batch_query.filter(MedicineBatch.hospital_id == hospital_id)

    batches = batch_query.all()

    total_units = 0
    total_reserved = 0
    total_mrp_value = 0.0
    total_cost_value = 0.0
    value_at_risk_60d = 0.0
    value_at_risk_30d = 0.0
    value_at_risk_7d = 0.0
    expired_value = 0.0

    risk_counts = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "normal": 0,
        "expired": 0,
    }

    for b in batches:
        units = b.available_quantity
        mrp_val = units * b.unit_mrp
        cost_val = units * b.unit_purchase_cost
        
        total_units += units
        total_reserved += b.reserved_quantity
        total_mrp_value += mrp_val
        total_cost_value += cost_val

        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)
        risk_counts[risk] = risk_counts.get(risk, 0) + 1

        if days <= 0:
            expired_value += mrp_val
        elif days <= 7:
            value_at_risk_7d += mrp_val
            value_at_risk_30d += mrp_val
            value_at_risk_60d += mrp_val
        elif days <= 30:
            value_at_risk_30d += mrp_val
            value_at_risk_60d += mrp_val
        elif days <= 60:
            value_at_risk_60d += mrp_val

    return {
        "total_active_batches": len(batches),
        "total_available_units": total_units,
        "total_reserved_units": total_reserved,
        "total_mrp_value": round(total_mrp_value, 2),
        "total_purchase_cost_value": round(total_cost_value, 2),
        "value_at_risk_60d": round(value_at_risk_60d, 2),
        "value_at_risk_30d": round(value_at_risk_30d, 2),
        "value_at_risk_7d": round(value_at_risk_7d, 2),
        "expired_value": round(expired_value, 2),
        "risk_counts": risk_counts,
    }


def get_hospital_inventory_list(
    db: Session,
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = "active",
    skip: int = 0,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Retrieve filtered list of inventory batches with computed expiry metrics."""
    query = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
    )

    if hospital_id is not None:
        query = query.filter(MedicineBatch.hospital_id == hospital_id)
    if medicine_id is not None:
        query = query.filter(MedicineBatch.medicine_id == medicine_id)
    if category:
        query = query.filter(Medicine.category.ilike(f"%{category}%"))
    if status_filter:
        query = query.filter(MedicineBatch.status == status_filter)

    batches = query.order_by(MedicineBatch.expiry_date.asc()).offset(skip).limit(limit).all()

    results = []
    for b in batches:
        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)
        results.append({
            "id": b.id,
            "medicine_id": b.medicine_id,
            "medicine_name": b.medicine.name,
            "generic_name": b.medicine.generic_name,
            "dosage_form": b.medicine.dosage_form,
            "strength": b.medicine.strength,
            "category": b.medicine.category,
            "hospital_id": b.hospital_id,
            "hospital_name": b.hospital.name,
            "hospital_city": b.hospital.city,
            "batch_number": b.batch_number,
            "available_quantity": b.available_quantity,
            "reserved_quantity": b.reserved_quantity,
            "unit_mrp": b.unit_mrp,
            "unit_purchase_cost": b.unit_purchase_cost,
            "total_batch_value": round(b.available_quantity * b.unit_mrp, 2),
            "manufacturing_date": b.manufacturing_date,
            "expiry_date": b.expiry_date,
            "days_to_expiry": days,
            "risk_level": risk,
            "storage_requirements": b.storage_requirements,
            "status": b.status,
            "is_demo": b.is_demo,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
        })
    return results
