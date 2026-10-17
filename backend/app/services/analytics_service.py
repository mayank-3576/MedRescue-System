import io
import csv
from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.medicine import Medicine
from app.models.batch import MedicineBatch
from app.models.hospital import Hospital
from app.models.alert import ExpiryAlert
from app.models.transfer import TransferRequest
from app.services.expiry_service import calculate_days_remaining, determine_risk_level


def get_analytics_overview(db: Session, hospital_id: Optional[int] = None) -> Dict[str, Any]:
    """Calculate multi-dimensional analytics on inventory risk, waste prevention, and transfer efficiency."""
    today = date.today()

    # Batches dataset
    batch_q = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
        .filter(MedicineBatch.status == "active")
    )
    if hospital_id is not None:
        batch_q = batch_q.filter(MedicineBatch.hospital_id == hospital_id)

    batches = batch_q.all()

    total_inventory_value = 0.0
    total_value_at_risk = 0.0

    risk_stats = {
        "critical": {"count": 0, "quantity": 0, "value": 0.0},
        "high": {"count": 0, "quantity": 0, "value": 0.0},
        "medium": {"count": 0, "quantity": 0, "value": 0.0},
        "low": {"count": 0, "quantity": 0, "value": 0.0},
        "normal": {"count": 0, "quantity": 0, "value": 0.0},
        "expired": {"count": 0, "quantity": 0, "value": 0.0},
    }

    category_stats = {}
    medicine_risk_map = {}

    for b in batches:
        val = b.available_quantity * b.unit_mrp
        total_inventory_value += val
        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)

        risk_stats[risk]["count"] += 1
        risk_stats[risk]["quantity"] += b.available_quantity
        risk_stats[risk]["value"] += val

        if days <= 60:
            total_value_at_risk += val

        # Category breakdown
        cat = b.medicine.category or "General"
        if cat not in category_stats:
            category_stats[cat] = {"total_batches": 0, "at_risk_batches": 0, "value_at_risk": 0.0}
        category_stats[cat]["total_batches"] += 1
        if days <= 60:
            category_stats[cat]["at_risk_batches"] += 1
            category_stats[cat]["value_at_risk"] += val

        # Top expiring medicines grouping
        med_id = b.medicine_id
        if days <= 90:
            if med_id not in medicine_risk_map:
                medicine_risk_map[med_id] = {
                    "medicine_id": med_id,
                    "medicine_name": b.medicine.name,
                    "generic_name": b.medicine.generic_name,
                    "category": b.medicine.category,
                    "expiring_batch_count": 0,
                    "total_units_at_risk": 0,
                    "total_value_at_risk": 0.0,
                    "earliest_expiry_days": days,
                }
            medicine_risk_map[med_id]["expiring_batch_count"] += 1
            medicine_risk_map[med_id]["total_units_at_risk"] += b.available_quantity
            medicine_risk_map[med_id]["total_value_at_risk"] += val
            if days < medicine_risk_map[med_id]["earliest_expiry_days"]:
                medicine_risk_map[med_id]["earliest_expiry_days"] = days

    # Transfers aggregation
    transfer_q = db.query(TransferRequest)
    if hospital_id is not None:
        transfer_q = transfer_q.filter(
            (TransferRequest.source_hospital_id == hospital_id) |
            (TransferRequest.destination_hospital_id == hospital_id)
        )
    transfers = transfer_q.all()

    transfer_status_map = {}
    rescued_value_total = 0.0

    for t in transfers:
        st = t.status
        t_val = (t.received_quantity or t.approved_quantity or t.requested_quantity) * (t.batch.unit_mrp if t.batch else 0.0)
        if st not in transfer_status_map:
            transfer_status_map[st] = {"count": 0, "total_value": 0.0}
        transfer_status_map[st]["count"] += 1
        transfer_status_map[st]["total_value"] += t_val

        if t.status == "received" and t.batch:
            rescued_value_total += (t.received_quantity * t.batch.unit_mrp)

    # Hospital performance aggregation
    all_hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
    hospital_perf = []

    for h in all_hospitals:
        if hospital_id is not None and h.id != hospital_id:
            continue
        
        h_batches = [b for b in batches if b.hospital_id == h.id] if hospital_id is None else batches
        h_inv_val = sum(b.available_quantity * b.unit_mrp for b in h_batches)
        h_risk_val = sum(b.available_quantity * b.unit_mrp for b in h_batches if calculate_days_remaining(b.expiry_date) <= 60)
        
        out_count = sum(1 for t in transfers if t.source_hospital_id == h.id)
        in_count = sum(1 for t in transfers if t.destination_hospital_id == h.id)
        h_rescued = sum(
            t.received_quantity * (t.batch.unit_mrp if t.batch else 0)
            for t in transfers if t.status == "received" and t.source_hospital_id == h.id
        )

        hospital_perf.append({
            "hospital_id": h.id,
            "hospital_name": h.name,
            "city": h.city,
            "total_inventory_value": round(h_inv_val, 2),
            "total_batches": len(h_batches),
            "total_units": sum(b.available_quantity for b in h_batches),
            "value_at_risk": round(h_risk_val, 2),
            "outbound_transfers_count": out_count,
            "inbound_transfers_count": in_count,
            "rescued_value": round(h_rescued, 2),
        })

    # Prevention rate
    denominator = rescued_value_total + total_value_at_risk
    prevention_rate = (rescued_value_total / denominator * 100.0) if denominator > 0 else 0.0

    # Format lists
    risk_breakdown = [
        {"risk_level": k, "batch_count": v["count"], "quantity": v["quantity"], "total_value": round(v["value"], 2)}
        for k, v in risk_stats.items()
    ]

    category_breakdown = [
        {"category": k, "total_batches": v["total_batches"], "at_risk_batches": v["at_risk_batches"], "value_at_risk": round(v["value_at_risk"], 2)}
        for k, v in category_stats.items()
    ]

    transfer_breakdown = [
        {"status": k, "count": v["count"], "total_value": round(v["total_value"], 2)}
        for k, v in transfer_status_map.items()
    ]

    top_expiring_meds = sorted(
        medicine_risk_map.values(),
        key=lambda x: (x["total_value_at_risk"], x["total_units_at_risk"]),
        reverse=True
    )[:10]

    return {
        "total_inventory_value": round(total_inventory_value, 2),
        "total_value_at_risk": round(total_value_at_risk, 2),
        "total_rescued_value": round(rescued_value_total, 2),
        "prevention_rate_percentage": round(prevention_rate, 2),
        "risk_breakdown": risk_breakdown,
        "category_breakdown": category_breakdown,
        "hospital_performance": hospital_perf,
        "transfer_status_breakdown": transfer_breakdown,
        "top_expiring_medicines": top_expiring_meds,
    }


def export_alerts_csv(db: Session, hospital_id: Optional[int] = None) -> str:
    """Generate RFC 4180 compliant CSV of expiry alerts."""
    query = (
        db.query(ExpiryAlert)
        .join(MedicineBatch, ExpiryAlert.batch_id == MedicineBatch.id)
        .join(Medicine, ExpiryAlert.medicine_id == Medicine.id)
        .join(Hospital, ExpiryAlert.hospital_id == Hospital.id)
    )
    if hospital_id is not None:
        query = query.filter(ExpiryAlert.hospital_id == hospital_id)

    alerts = query.all()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Alert ID", "Hospital", "City", "Medicine Name", "Generic Name",
        "Batch Number", "Risk Level", "Days Remaining", "Status",
        "Available Quantity", "Unit MRP", "Value at Risk", "Created At"
    ])

    for a in alerts:
        val_at_risk = round(a.batch.available_quantity * a.batch.unit_mrp, 2) if a.batch else 0.0
        writer.writerow([
            a.id,
            a.hospital.name if a.hospital else "",
            a.hospital.city if a.hospital else "",
            a.medicine.name if a.medicine else "",
            a.medicine.generic_name if a.medicine else "",
            a.batch.batch_number if a.batch else "",
            a.risk_level,
            a.days_remaining,
            a.alert_status,
            a.batch.available_quantity if a.batch else 0,
            a.batch.unit_mrp if a.batch else 0.0,
            val_at_risk,
            a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else "",
        ])

    return output.getvalue()


def export_transfers_csv(db: Session, hospital_id: Optional[int] = None) -> str:
    """Generate CSV of all transfer requests."""
    query = (
        db.query(TransferRequest)
        .join(Medicine, TransferRequest.medicine_id == Medicine.id)
        .join(MedicineBatch, TransferRequest.batch_id == MedicineBatch.id)
    )
    if hospital_id is not None:
        query = query.filter(
            (TransferRequest.source_hospital_id == hospital_id) |
            (TransferRequest.destination_hospital_id == hospital_id)
        )

    transfers = query.all()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Transfer ID", "Source Hospital", "Destination Hospital", "Medicine Name",
        "Batch Number", "Requested Qty", "Approved Qty", "Dispatched Qty", "Received Qty",
        "Status", "Distance (KM)", "Road Distance", "Delivery Cost", "Total Value", "Created At"
    ])

    for t in transfers:
        tot_val = round((t.received_quantity or t.approved_quantity or t.requested_quantity) * (t.batch.unit_mrp if t.batch else 0.0), 2)
        writer.writerow([
            t.id,
            t.source_hospital.name if t.source_hospital else "",
            t.destination_hospital.name if t.destination_hospital else "",
            t.medicine.name if t.medicine else "",
            t.batch.batch_number if t.batch else "",
            t.requested_quantity,
            t.approved_quantity,
            t.dispatched_quantity,
            t.received_quantity,
            t.status,
            t.route_distance_km or 0.0,
            "Yes" if t.is_road_distance else "No",
            t.delivery_cost or 0.0,
            tot_val,
            t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else "",
        ])

    return output.getvalue()


def export_batches_csv(db: Session, hospital_id: Optional[int] = None) -> str:
    """Generate CSV of medicine batches."""
    query = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
    )
    if hospital_id is not None:
        query = query.filter(MedicineBatch.hospital_id == hospital_id)

    batches = query.all()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Batch ID", "Hospital", "City", "Medicine Name", "Generic Name", "Strength",
        "Category", "Batch Number", "Available Qty", "Reserved Qty", "Unit MRP",
        "Unit Purchase Cost", "Total MRP Value", "Manufacturing Date", "Expiry Date",
        "Days Remaining", "Risk Level", "Status"
    ])

    for b in batches:
        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)
        tot_val = round(b.available_quantity * b.unit_mrp, 2)
        writer.writerow([
            b.id,
            b.hospital.name if b.hospital else "",
            b.hospital.city if b.hospital else "",
            b.medicine.name if b.medicine else "",
            b.medicine.generic_name if b.medicine else "",
            b.medicine.strength if b.medicine else "",
            b.medicine.category if b.medicine else "",
            b.batch_number,
            b.available_quantity,
            b.reserved_quantity,
            b.unit_mrp,
            b.unit_purchase_cost,
            tot_val,
            b.manufacturing_date,
            b.expiry_date,
            days,
            risk,
            b.status,
        ])

    return output.getvalue()
