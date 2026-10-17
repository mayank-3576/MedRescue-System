from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import asc

from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.services.expiry_service import calculate_days_remaining, determine_risk_level


def get_fefo_ranked_batches(
    db: Session,
    medicine_id: int,
    hospital_id: Optional[int] = None,
    required_quantity: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Implements First-Expired, First-Out (FEFO) dispensing optimization.
    Returns batches ordered by expiry date ascending, with allocated quantities
    if required_quantity is specified.
    """
    today = date.today()

    query = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
        .filter(
            MedicineBatch.medicine_id == medicine_id,
            MedicineBatch.status == "active",
            MedicineBatch.available_quantity > 0,
            MedicineBatch.expiry_date >= today,
        )
    )

    if hospital_id is not None:
        query = query.filter(MedicineBatch.hospital_id == hospital_id)

    # Order by earliest expiry date first (FEFO core rule)
    batches = query.order_by(asc(MedicineBatch.expiry_date), asc(MedicineBatch.available_quantity)).all()

    remaining_needed = required_quantity if required_quantity is not None else 0
    ranked_results = []
    total_allocated = 0
    rank = 1

    for batch in batches:
        days_rem = calculate_days_remaining(batch.expiry_date)
        risk = determine_risk_level(days_rem)

        alloc = 0
        if required_quantity is not None and remaining_needed > 0:
            alloc = min(batch.available_quantity, remaining_needed)
            remaining_needed -= alloc
            total_allocated += alloc

        ranked_results.append({
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "medicine_id": batch.medicine_id,
            "medicine_name": batch.medicine.name,
            "hospital_id": batch.hospital_id,
            "hospital_name": batch.hospital.name,
            "expiry_date": batch.expiry_date,
            "days_remaining": days_rem,
            "risk_level": risk,
            "available_quantity": batch.available_quantity,
            "allocated_quantity": alloc,
            "unit_mrp": batch.unit_mrp,
            "fefo_priority_rank": rank,
        })
        rank += 1

    fulfilled = False
    shortfall = 0
    if required_quantity is not None:
        shortfall = max(0, required_quantity - total_allocated)
        fulfilled = (shortfall == 0)

    return {
        "medicine_id": medicine_id,
        "required_quantity": required_quantity,
        "total_allocated": total_allocated,
        "shortfall": shortfall,
        "fulfilled": fulfilled,
        "batches": ranked_results,
    }


def get_all_fefo_batches_for_hospital(
    db: Session,
    hospital_id: int,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get FEFO dispensing schedule for all active medicines at a specific hospital.
    """
    today = date.today()
    batches = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .filter(
            MedicineBatch.hospital_id == hospital_id,
            MedicineBatch.status == "active",
            MedicineBatch.available_quantity > 0,
            MedicineBatch.expiry_date >= today,
        )
        .order_by(asc(MedicineBatch.expiry_date))
        .limit(limit)
        .all()
    )

    results = []
    for rank, batch in enumerate(batches, start=1):
        days_rem = calculate_days_remaining(batch.expiry_date)
        results.append({
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "medicine_id": batch.medicine_id,
            "medicine_name": batch.medicine.name,
            "hospital_id": batch.hospital_id,
            "hospital_name": batch.hospital.name,
            "expiry_date": batch.expiry_date,
            "days_remaining": days_rem,
            "risk_level": determine_risk_level(days_rem),
            "available_quantity": batch.available_quantity,
            "allocated_quantity": batch.available_quantity,
            "unit_mrp": batch.unit_mrp,
            "fefo_priority_rank": rank,
        })
    return results
