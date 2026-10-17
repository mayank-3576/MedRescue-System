from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.hospital import Hospital
from app.models.batch import MedicineBatch
from app.models.alert import ExpiryAlert
from app.models.demand import DemandRecord
from app.models.user import User
from app.schemas.hospital import (
    HospitalCreate,
    HospitalUpdate,
    HospitalResponse,
    HospitalDetailResponse,
    PMJAYVerificationConfirmation,
    GovHospitalIdVerifyRequest,
    GovHospitalIdVerifyResponse,
)
from app.auth.security import get_current_active_user
from app.auth.permissions import require_admin
from app.services.audit_service import log_audit_event
from app.services.government_verification_service import verify_government_hospital_id

router = APIRouter(prefix="/api/hospitals", tags=["Hospitals"])


@router.post("/verify-gov-id", response_model=GovHospitalIdVerifyResponse)
def verify_gov_id(
    payload: GovHospitalIdVerifyRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Verify Government Hospital ID against the National Health Facility Registry (ABDM/PMJAY/NIN/ROHINI).
    Must pass verification before any hospital entry can be permitted.
    """
    result = verify_government_hospital_id(
        gov_hospital_id=payload.gov_hospital_id,
        hospital_name=payload.hospital_name,
        city=payload.city,
        state=payload.state,
    )
    return GovHospitalIdVerifyResponse(**result)


@router.get("", response_model=List[HospitalResponse])
def list_hospitals(
    city: Optional[str] = None,
    state: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all registered hospitals."""
    query = db.query(Hospital)
    if city:
        query = query.filter(Hospital.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(Hospital.state.ilike(f"%{state}%"))
    if is_active is not None:
        query = query.filter(Hospital.is_active == is_active)

    hospitals = query.order_by(Hospital.name.asc()).offset(skip).limit(limit).all()
    return hospitals


@router.get("/{hospital_id}", response_model=HospitalDetailResponse)
def get_hospital(
    hospital_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve detailed hospital profile with inventory and alert metrics."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")

    active_batches = db.query(MedicineBatch).filter(MedicineBatch.hospital_id == hospital_id, MedicineBatch.status == "active").all()
    batches_count = len(active_batches)
    inv_value = sum(b.available_quantity * b.unit_mrp for b in active_batches)

    alerts_count = (
        db.query(func.count(ExpiryAlert.id))
        .filter(ExpiryAlert.hospital_id == hospital_id, ExpiryAlert.alert_status == "active")
        .scalar() or 0
    )

    demands_count = (
        db.query(func.count(DemandRecord.id))
        .filter(DemandRecord.hospital_id == hospital_id, DemandRecord.is_active == True)
        .scalar() or 0
    )

    return HospitalDetailResponse(
        id=hospital.id,
        name=hospital.name,
        code=hospital.code,
        pmjay_hospital_id=hospital.pmjay_hospital_id,
        pmjay_verification_status=hospital.pmjay_verification_status,
        pmjay_verified_at=hospital.pmjay_verified_at,
        pmjay_verified_by=hospital.pmjay_verified_by,
        address=hospital.address,
        city=hospital.city,
        state=hospital.state,
        pincode=hospital.pincode,
        bed_capacity=hospital.bed_capacity,
        hospital_type=hospital.hospital_type,
        latitude=hospital.latitude,
        longitude=hospital.longitude,
        is_active=hospital.is_active,
        contact_phone=hospital.contact_phone,
        contact_email=hospital.contact_email,
        created_at=hospital.created_at,
        updated_at=hospital.updated_at,
        active_batches_count=batches_count,
        active_alerts_count=alerts_count,
        pending_demands_count=demands_count,
        total_inventory_value=round(inv_value, 2),
    )


@router.post("", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(
    hospital_data: HospitalCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new hospital (Admin only).
    Enforces government hospital ID verification before permitting hospital entry.
    """
    pmjay_id = (hospital_data.pmjay_hospital_id or "").strip()
    if not pmjay_id:
        raise HTTPException(
            status_code=422,
            detail="Government Hospital ID (ABDM / PMJAY / NIN / ROHINI) is mandatory for onboarding.",
        )

    # Perform mandatory Government Hospital ID verification check
    gov_verif = verify_government_hospital_id(
        gov_hospital_id=pmjay_id,
        hospital_name=hospital_data.name,
        city=hospital_data.city,
        state=hospital_data.state,
    )
    if not gov_verif.get("is_valid") or not gov_verif.get("authorized_to_operate"):
        raise HTTPException(
            status_code=400,
            detail=f"Hospital entry prohibited: {gov_verif.get('message', 'Government Hospital ID verification failed.')}",
        )

    existing_id = db.query(Hospital).filter(Hospital.pmjay_hospital_id == pmjay_id).first()
    if existing_id:
        raise HTTPException(status_code=409, detail="This Government / PM-JAY hospital ID is already registered in the network.")
    existing = db.query(Hospital).filter(Hospital.name == hospital_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hospital with name '{hospital_data.name}' already exists"
        )

    payload = hospital_data.model_dump(exclude={"pmjay_verification_status", "pmjay_verified_at", "pmjay_verified_by"})
    # Permitted and activated immediately upon successful government verification
    payload.update(
        pmjay_hospital_id=pmjay_id,
        pmjay_verification_status="verified_registry",
        pmjay_verified_at=datetime.utcnow(),
        pmjay_verified_by=admin_user.id,
        is_active=True,
    )
    hospital = Hospital(**payload)
    db.add(hospital)
    db.commit()
    db.refresh(hospital)

    log_audit_event(
        db=db,
        action="CREATE_HOSPITAL_GOV_VERIFIED",
        entity_type="hospital",
        entity_id=hospital.id,
        user_id=admin_user.id,
        details={
            "name": hospital.name,
            "city": hospital.city,
            "pmjay_hospital_id": pmjay_id,
            "verification_status": "verified_registry",
            "certificate": gov_verif.get("verification_certificate"),
            "authority": gov_verif.get("registry_authority"),
        }
    )

    return hospital


@router.put("/{hospital_id}", response_model=HospitalResponse)
def update_hospital(
    hospital_id: int,
    update_data: HospitalUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update hospital details (Admin only)."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")

    updates = update_data.model_dump(exclude_unset=True)
    if "pmjay_hospital_id" in updates:
        pmjay_id = (updates["pmjay_hospital_id"] or "").strip()
        if not pmjay_id:
            raise HTTPException(status_code=422, detail="PM-JAY hospital reference ID is required")
        duplicate = db.query(Hospital).filter(Hospital.pmjay_hospital_id == pmjay_id, Hospital.id != hospital_id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="This PM-JAY hospital ID is already registered")
        updates["pmjay_hospital_id"] = pmjay_id
        if hospital.pmjay_hospital_id != pmjay_id:
            hospital.pmjay_verification_status = "pending"
            hospital.pmjay_verified_at = None
            hospital.pmjay_verified_by = None
            hospital.is_active = False
    if updates.get("is_active") is True and hospital.pmjay_verification_status != "verified_manual":
        raise HTTPException(status_code=409, detail="Confirm this hospital against the official PM-JAY registry before activation")
    for field, val in updates.items():
        setattr(hospital, field, val)

    db.add(hospital)
    db.commit()
    db.refresh(hospital)

    log_audit_event(
        db=db,
        action="UPDATE_HOSPITAL",
        entity_type="hospital",
        entity_id=hospital.id,
        user_id=admin_user.id,
        details=update_data.model_dump(exclude_unset=True)
    )

    return hospital


@router.post("/{hospital_id}/pmjay-verification", response_model=HospitalResponse)
def confirm_pmjay_verification(
    hospital_id: int,
    data: PMJAYVerificationConfirmation,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Record an administrator's manual confirmation against the official PM-JAY portal."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if not data.confirmed:
        hospital.pmjay_verification_status = "rejected"
        hospital.is_active = False
    else:
        if not hospital.pmjay_hospital_id:
            raise HTTPException(status_code=409, detail="A PM-JAY hospital ID is required")
        hospital.pmjay_verification_status = "verified_manual"
        hospital.pmjay_verified_at = datetime.utcnow()
        hospital.pmjay_verified_by = admin_user.id
        hospital.is_active = True
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    log_audit_event(
        db=db,
        action="PMJAY_HOSPITAL_VERIFICATION",
        entity_type="hospital",
        entity_id=hospital.id,
        user_id=admin_user.id,
        details={"pmjay_hospital_id": hospital.pmjay_hospital_id, "status": hospital.pmjay_verification_status, "method": "manual_official_portal_check", "notes": data.notes},
    )
    return hospital


@router.delete("/{hospital_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hospital(
    hospital_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate or remove a hospital (Admin only)."""
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")

    # Soft-delete by marking inactive
    hospital.is_active = False
    db.add(hospital)
    db.commit()

    log_audit_event(
        db=db,
        action="DEACTIVATE_HOSPITAL",
        entity_type="hospital",
        entity_id=hospital.id,
        user_id=admin_user.id
    )
    return None
