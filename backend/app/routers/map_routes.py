from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.hospital import Hospital
from app.models.batch import MedicineBatch
from app.models.alert import ExpiryAlert
from app.models.transfer import TransferRequest
from app.models.user import User
from app.schemas.hospital import HospitalGeoFeature
from app.auth.security import get_current_active_user

router = APIRouter(prefix="/api/map", tags=["Map & Geospatial"])


@router.get("/hospitals", response_model=List[HospitalGeoFeature])
def get_map_hospitals(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve hospital geocoded locations with contextual alert and inventory metrics."""
    hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()

    # Pre-fetch counts
    alert_counts = (
        db.query(ExpiryAlert.hospital_id, func.count(ExpiryAlert.id))
        .filter(ExpiryAlert.alert_status == "active")
        .group_by(ExpiryAlert.hospital_id)
        .all()
    )
    alert_map = {h_id: count for h_id, count in alert_counts}

    critical_counts = (
        db.query(ExpiryAlert.hospital_id, func.count(ExpiryAlert.id))
        .filter(ExpiryAlert.alert_status == "active", ExpiryAlert.risk_level == "critical")
        .group_by(ExpiryAlert.hospital_id)
        .all()
    )
    critical_map = {h_id: count for h_id, count in critical_counts}

    batch_counts = (
        db.query(MedicineBatch.hospital_id, func.count(MedicineBatch.id))
        .filter(MedicineBatch.status == "active")
        .group_by(MedicineBatch.hospital_id)
        .all()
    )
    batch_map = {h_id: count for h_id, count in batch_counts}

    features = []
    for h in hospitals:
        features.append(HospitalGeoFeature(
            id=h.id,
            name=h.name,
            city=h.city,
            state=h.state,
            latitude=h.latitude,
            longitude=h.longitude,
            active_alerts_count=alert_map.get(h.id, 0),
            critical_alerts_count=critical_map.get(h.id, 0),
            total_batches=batch_map.get(h.id, 0),
            contact_phone=h.contact_phone,
            contact_email=h.contact_email,
        ))
    return features


@router.get("/routes")
def get_active_map_routes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve geo-lines for in-transit and active transfer requests to display on maps."""
    active_transfers = (
        db.query(TransferRequest)
        .join(Hospital, TransferRequest.source_hospital_id == Hospital.id)
        .filter(TransferRequest.status.in_(["pending_approval", "approved", "dispatched"]))
        .all()
    )

    routes = []
    for t in active_transfers:
        src = t.source_hospital
        dst = t.destination_hospital
        if src and dst:
            routes.append({
                "transfer_id": t.id,
                "status": t.status,
                "medicine_name": t.medicine.name if t.medicine else "Unknown",
                "quantity": t.requested_quantity,
                "source": {
                    "id": src.id,
                    "name": src.name,
                    "city": src.city,
                    "latitude": src.latitude,
                    "longitude": src.longitude,
                },
                "destination": {
                    "id": dst.id,
                    "name": dst.name,
                    "city": dst.city,
                    "latitude": dst.latitude,
                    "longitude": dst.longitude,
                },
                "distance_km": t.route_distance_km,
                "delivery_cost": t.delivery_cost,
                "is_road_distance": t.is_road_distance,
            })

    return routes
