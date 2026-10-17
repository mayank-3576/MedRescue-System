from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.batch import MedicineBatch
from app.models.hospital import Hospital
from app.models.medicine import Medicine
from app.models.demand import DemandRecord
from app.models.transfer import TransferRequest
from app.models.setting import ApplicationSetting
from app.config import settings
from app.services.expiry_service import calculate_days_remaining, determine_risk_level
from app.services.delivery_service import calculate_route_sync, get_delivery_rates


def get_min_shelf_life_days(db: Session) -> int:
    """Fetch minimum shelf life setting."""
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "min_shelf_life_days").first()
    if setting:
        try:
            return int(setting.value)
        except ValueError:
            pass
    return settings.MIN_SHELF_LIFE_DAYS


def get_max_delivery_radius(db: Session) -> float:
    """Fetch maximum allowed delivery radius in kilometers."""
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "max_delivery_radius_km").first()
    if setting:
        try:
            return float(setting.value)
        except ValueError:
            pass
    return settings.MAX_DELIVERY_RADIUS_KM


def run_rescue_engine(
    db: Session,
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    max_days_ahead: int = 90,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Executes the 7-step MedRescue System engine to discover and recommend proactive stock redistributions.
    
    Steps:
    1. Identify at-risk batches (batches nearing expiry with available stock)
    2. Check batch eligibility (active status, shelf life > minimum threshold)
    3. Match recipient demand (explicit demand records or low inventory hospitals)
    4. Calculate feasibility (distance, routing, delivery cost, transit time)
    5. Check constraints (radius limit, shelf life > transit buffer, net financial gain)
    6. Rank recommendations (urgency, demand priority, cost-benefit ratio)
    7. Generate structured recommendations with rationale
    """
    today = date.today()
    min_shelf_life = get_min_shelf_life_days(db)
    max_radius = get_max_delivery_radius(db)
    cost_per_km, fixed_charge = get_delivery_rates(db)

    # -------------------------------------------------------------
    # STEP 1: Identify at-risk batches
    # -------------------------------------------------------------
    batch_query = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
        .filter(
            MedicineBatch.status == "active",
            MedicineBatch.available_quantity > 0,
            MedicineBatch.expiry_date >= today,
        )
    )

    if hospital_id is not None:
        batch_query = batch_query.filter(MedicineBatch.hospital_id == hospital_id)
    if medicine_id is not None:
        batch_query = batch_query.filter(MedicineBatch.medicine_id == medicine_id)

    candidate_batches = batch_query.all()
    total_evaluated = len(candidate_batches)

    # Filter batches with remaining days <= max_days_ahead
    at_risk_batches = []
    for batch in candidate_batches:
        days = calculate_days_remaining(batch.expiry_date)
        if days <= max_days_ahead:
            at_risk_batches.append((batch, days))

    total_at_risk = len(at_risk_batches)

    # -------------------------------------------------------------
    # STEP 2: Check eligibility
    # -------------------------------------------------------------
    eligible_batches = []
    for batch, days in at_risk_batches:
        # Must have enough days left to be useful post-transfer
        if days >= min_shelf_life and batch.available_quantity > 0:
            eligible_batches.append((batch, days))

    total_eligible = len(eligible_batches)

    # Pre-fetch all active hospitals for route calculations
    all_hospitals = {h.id: h for h in db.query(Hospital).filter(Hospital.is_active == True).all()}

    # Pre-fetch active demands
    all_demands = (
        db.query(DemandRecord)
        .filter(DemandRecord.is_active == True)
        .all()
    )
    # Map (medicine_id, hospital_id) -> DemandRecord
    demand_map = {}
    for dem in all_demands:
        demand_map[(dem.medicine_id, dem.hospital_id)] = dem

    recommendations = []

    # -------------------------------------------------------------
    # STEP 3 & 4 & 5: Match demand, Calculate Feasibility, Check Constraints
    # -------------------------------------------------------------
    for batch, days_to_expiry in eligible_batches:
        src_hospital = all_hospitals.get(batch.hospital_id)
        if not src_hospital or not src_hospital.is_active:
            continue

        # Look for potential recipient hospitals (other than source hospital)
        for dest_id, dest_hospital in all_hospitals.items():
            if dest_id == src_hospital.id:
                continue

            open_transfer = db.query(TransferRequest.id).filter(
                TransferRequest.batch_id == batch.id,
                TransferRequest.destination_hospital_id == dest_id,
                TransferRequest.status.in_(["pending_approval", "approved", "dispatched"]),
            ).first()
            if open_transfer:
                continue

            # Check if destination hospital has an active demand record
            explicit_demand = demand_map.get((batch.medicine_id, dest_id))
            
            # Or destination hospital has zero/low stock of this medicine
            dest_stock_sum = (
                db.query(func.coalesce(func.sum(MedicineBatch.available_quantity), 0))
                .filter(
                    MedicineBatch.hospital_id == dest_id,
                    MedicineBatch.medicine_id == batch.medicine_id,
                    MedicineBatch.status == "active",
                    MedicineBatch.expiry_date >= today
                )
                .scalar()
            ) or 0

            # Only proceed if there is demand OR dest stock is low (< 100)
            if not explicit_demand and dest_stock_sum >= 100:
                continue

            # Calculate route metrics
            route_info = calculate_route_sync(
                src_hospital.latitude,
                src_hospital.longitude,
                dest_hospital.latitude,
                dest_hospital.longitude,
                db=db
            )
            dist_km = route_info["distance_km"]
            is_road = route_info["is_road_distance"]
            delivery_cost = route_info["estimated_cost"]
            transit_hours = route_info["duration_hours"]
            transit_days = max(1, int(transit_hours / 24.0) + 1)

            # Constraint checks:
            # 1. Within max delivery radius
            if dist_km > max_radius:
                continue

            # 2. Shelf life exceeds transit days + safety margin (3 days)
            if days_to_expiry < (transit_days + 3):
                continue

            # Determine proposed quantity
            if explicit_demand:
                target_qty = min(batch.available_quantity, explicit_demand.required_quantity)
            else:
                target_qty = min(batch.available_quantity, 100)

            if target_qty <= 0:
                continue

            total_mrp_value = round(target_qty * batch.unit_mrp, 2)
            net_saved = round(total_mrp_value - delivery_cost, 2)

            # Constraint 3: Economic viability
            if net_saved <= 0:
                continue

            # -------------------------------------------------------------
            # STEP 6: Rank & Score
            # -------------------------------------------------------------
            # Urgency score: higher when expiry is closer (0-100)
            urgency_score = round(max(0.0, min(100.0, (1.0 - (days_to_expiry / max_days_ahead)) * 100.0)), 1)

            # Demand score: explicit critical=40, high=30, medium=20, low=10, opportunistic=5
            demand_weight = 5.0
            if explicit_demand:
                p = explicit_demand.priority.lower()
                if p == "critical":
                    demand_weight = 40.0
                elif p == "high":
                    demand_weight = 30.0
                elif p == "medium":
                    demand_weight = 20.0
                else:
                    demand_weight = 10.0

            # Distance factor: closer hospitals score higher (0-30)
            distance_score = max(0.0, 30.0 * (1.0 - (dist_km / max_radius)))

            # Economic ratio: savings efficiency (0-30)
            economic_ratio = min(30.0, (net_saved / max(1.0, total_mrp_value)) * 30.0)

            feasibility_score = round(min(100.0, demand_weight + distance_score + economic_ratio), 1)

            # Generate clear rationale
            risk_cat = determine_risk_level(days_to_expiry)
            if explicit_demand:
                rationale = (
                    f"Urgent match: {dest_hospital.name} filed {explicit_demand.priority.upper()} demand for "
                    f"{batch.medicine.name}. Batch {batch.batch_number} has {days_to_expiry} days remaining. "
                    f"Transfer saves ₹{net_saved:,.2f} worth of medicine after ₹{delivery_cost:,.2f} transit."
                )
            else:
                rationale = (
                    f"Proactive redistribution: {dest_hospital.name} has low stock ({dest_stock_sum} units). "
                    f"Batch {batch.batch_number} at {src_hospital.name} is in '{risk_cat}' risk ({days_to_expiry} days). "
                    f"Net rescue value: ₹{net_saved:,.2f}."
                )

            recommendations.append({
                "batch_id": batch.id,
                "batch_number": batch.batch_number,
                "medicine_id": batch.medicine_id,
                "medicine_name": batch.medicine.name,
                "generic_name": batch.medicine.generic_name,
                "category": batch.medicine.category,
                "source_hospital_id": src_hospital.id,
                "source_hospital_name": src_hospital.name,
                "source_hospital_city": src_hospital.city,
                "source_latitude": src_hospital.latitude,
                "source_longitude": src_hospital.longitude,
                "destination_hospital_id": dest_hospital.id,
                "destination_hospital_name": dest_hospital.name,
                "destination_hospital_city": dest_hospital.city,
                "destination_latitude": dest_hospital.latitude,
                "destination_longitude": dest_hospital.longitude,
                "expiry_date": str(batch.expiry_date),
                "days_to_expiry": days_to_expiry,
                "risk_level": risk_cat,
                "available_quantity": batch.available_quantity,
                "recommended_transfer_quantity": target_qty,
                "unit_mrp": batch.unit_mrp,
                "total_batch_value": total_mrp_value,
                "estimated_distance_km": dist_km,
                "is_road_distance": is_road,
                "estimated_delivery_cost": delivery_cost,
                "net_value_saved": net_saved,
                "feasibility_score": feasibility_score,
                "demand_priority": explicit_demand.priority.lower() if explicit_demand else "routine",
                "urgency_score": urgency_score,
                "combined_rank_score": round((feasibility_score * 0.6) + (urgency_score * 0.4), 2),
                "rationale": rationale,
            })

    # Sort recommendations by combined ranking score descending, then net_value_saved descending
    recommendations.sort(key=lambda r: (r["combined_rank_score"], r["net_value_saved"]), reverse=True)

    # -------------------------------------------------------------
    # STEP 7: Formulate Final Report
    # -------------------------------------------------------------
    final_recs = []
    for rank, item in enumerate(recommendations[:limit], start=1):
        item["recommendation_rank"] = rank
        final_recs.append(item)

    total_potential_saved = round(sum(r["net_value_saved"] for r in final_recs), 2)

    return {
        "total_evaluated_batches": total_evaluated,
        "total_at_risk_identified": total_at_risk,
        "total_eligible_batches": total_eligible,
        "total_recommendations_generated": len(final_recs),
        "total_potential_value_saved": total_potential_saved,
        "recommendations": final_recs,
    }
