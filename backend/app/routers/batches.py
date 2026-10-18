from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.models.user import User
from app.models.inventory_movement import InventoryMovement
from app.schemas.batch import (
    BatchCreate,
    BatchUpdate,
    BatchResponse,
    BatchWithDetailsResponse,
    QuickScanAddRequest,
    QuickScanAddResponse,
)
from app.auth.security import get_current_active_user
from app.auth.permissions import verify_hospital_access, require_admin
from app.services.expiry_service import calculate_days_remaining, determine_risk_level, sync_batch_alert
from app.services.audit_service import log_audit_event
from app.services.barcode_catalog_service import direct_scan_and_add_batch
from app.validation import validate_batch_dates

router = APIRouter(prefix="/api/batches", tags=["Batches"])


@router.post("/quick-scan-add", response_model=QuickScanAddResponse)
def quick_scan_and_add(
    data: QuickScanAddRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Direct Barcode Inward Entry:
    Instantly registers or selects medicine by barcode, adds stock to hospital inventory,
    logs movements, and activates expiry monitoring in a single automated step.
    """
    target_hospital_id = current_user.hospital_id if current_user.role == "staff" else data.hospital_id
    if target_hospital_id is None:
        # If admin doesn't provide hospital_id, default to first active hospital
        first_hosp = db.query(Hospital).filter(Hospital.is_active.is_(True)).first()
        if not first_hosp:
            raise HTTPException(status_code=400, detail="No active hospital found for stock assignment")
        target_hospital_id = first_hosp.id

    verify_hospital_access(target_hospital_id, current_user)

    try:
        result = direct_scan_and_add_batch(
            db=db,
            barcode=data.barcode,
            hospital_id=target_hospital_id,
            quantity=data.quantity,
            batch_number=data.batch_number,
            expiry_date=data.expiry_date,
            manufacturing_date=data.manufacturing_date,
            unit_mrp=data.unit_mrp,
            unit_purchase_cost=data.unit_purchase_cost,
            storage_requirements=data.storage_requirements,
            user_id=current_user.id,
        )
        return QuickScanAddResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=List[BatchWithDetailsResponse])
def list_batches(
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    risk_level: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List inventory batches with hospital isolation rules:
    - Hospital staff can only view batches belonging to their hospital.
    - Administrators can view batches across all hospitals.
    """
    query = (
        db.query(MedicineBatch)
        .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
        .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
    )

    # Hospital isolation
    if current_user.role == "staff":
        query = query.filter(MedicineBatch.hospital_id == current_user.hospital_id)
    elif hospital_id is not None:
        query = query.filter(MedicineBatch.hospital_id == hospital_id)

    if medicine_id is not None:
        query = query.filter(MedicineBatch.medicine_id == medicine_id)
    if status_filter:
        query = query.filter(MedicineBatch.status == status_filter)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                MedicineBatch.batch_number.ilike(search_pattern),
                Medicine.name.ilike(search_pattern),
                Medicine.generic_name.ilike(search_pattern),
            )
        )

    batches = query.order_by(MedicineBatch.expiry_date.asc()).offset(skip).limit(limit).all()

    results = []
    for b in batches:
        days = calculate_days_remaining(b.expiry_date)
        risk = determine_risk_level(days)

        if risk_level and risk != risk_level:
            continue

        results.append(BatchWithDetailsResponse(
            id=b.id,
            medicine_id=b.medicine_id,
            hospital_id=b.hospital_id,
            batch_number=b.batch_number,
            available_quantity=b.available_quantity,
            reserved_quantity=b.reserved_quantity,
            unit_mrp=b.unit_mrp,
            unit_purchase_cost=b.unit_purchase_cost,
            manufacturing_date=b.manufacturing_date,
            expiry_date=b.expiry_date,
            storage_requirements=b.storage_requirements,
            status=b.status,
            is_demo=b.is_demo,
            created_at=b.created_at,
            updated_at=b.updated_at,
            medicine_name=b.medicine.name if b.medicine else None,
            generic_name=b.medicine.generic_name if b.medicine else None,
            dosage_form=b.medicine.dosage_form if b.medicine else None,
            strength=b.medicine.strength if b.medicine else None,
            category=b.medicine.category if b.medicine else None,
            hospital_name=b.hospital.name if b.hospital else None,
            hospital_city=b.hospital.city if b.hospital else None,
            days_to_expiry=days,
            risk_level=risk,
            total_batch_value=round(b.available_quantity * b.unit_mrp, 2),
        ))

    return results


@router.get("/{batch_id}", response_model=BatchWithDetailsResponse)
def get_batch(
    batch_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get single batch details with permission verification."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    verify_hospital_access(batch.hospital_id, current_user)

    days = calculate_days_remaining(batch.expiry_date)
    risk = determine_risk_level(days)

    return BatchWithDetailsResponse(
        id=batch.id,
        medicine_id=batch.medicine_id,
        hospital_id=batch.hospital_id,
        batch_number=batch.batch_number,
        available_quantity=batch.available_quantity,
        reserved_quantity=batch.reserved_quantity,
        unit_mrp=batch.unit_mrp,
        unit_purchase_cost=batch.unit_purchase_cost,
        manufacturing_date=batch.manufacturing_date,
        expiry_date=batch.expiry_date,
        storage_requirements=batch.storage_requirements,
        status=batch.status,
        is_demo=batch.is_demo,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        medicine_name=batch.medicine.name if batch.medicine else None,
        generic_name=batch.medicine.generic_name if batch.medicine else None,
        dosage_form=batch.medicine.dosage_form if batch.medicine else None,
        strength=batch.medicine.strength if batch.medicine else None,
        category=batch.medicine.category if batch.medicine else None,
        hospital_name=batch.hospital.name if batch.hospital else None,
        hospital_city=batch.hospital.city if batch.hospital else None,
        days_to_expiry=days,
        risk_level=risk,
        total_batch_value=round(batch.available_quantity * batch.unit_mrp, 2),
    )


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch_data: BatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Register a new medicine batch into inventory.
    Enforces hospital assignment permissions and triggers automatic expiry alert evaluation.
    """
    verify_hospital_access(batch_data.hospital_id, current_user)
    target_hospital = db.query(Hospital).filter(Hospital.id == batch_data.hospital_id, Hospital.is_active.is_(True)).first()
    if not target_hospital:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inventory can only be entered for verified active hospitals")

    # Check for duplicate batch number
    existing = db.query(MedicineBatch).filter(MedicineBatch.batch_number == batch_data.batch_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch number '{batch_data.batch_number}' already exists in system"
        )

    # Verify medicine exists
    med = db.query(Medicine).filter(Medicine.id == batch_data.medicine_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine ID not found")

    batch = MedicineBatch(**batch_data.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Automatically compute and create alert
    sync_batch_alert(db, batch)
    db.add(InventoryMovement(
        hospital_id=batch.hospital_id, medicine_id=batch.medicine_id, batch_id=batch.id,
        user_id=current_user.id, movement_type="initial_stock", quantity_change=batch.available_quantity,
        reference=f"batch:{batch.id}", notes="Batch registered in inventory",
    ))
    db.commit()

    log_audit_event(
        db=db,
        action="CREATE_BATCH",
        entity_type="batch",
        entity_id=batch.id,
        user_id=current_user.id,
        details={
            "batch_number": batch.batch_number,
            "medicine_id": batch.medicine_id,
            "hospital_id": batch.hospital_id,
            "quantity": batch.available_quantity,
        }
    )

    return batch


@router.put("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    update_data: BatchUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update batch inventory, pricing, or status."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    verify_hospital_access(batch.hospital_id, current_user)

    dump = update_data.model_dump(exclude_unset=True)
    manufacturing_date = dump.get("manufacturing_date", batch.manufacturing_date)
    expiry_date = dump.get("expiry_date", batch.expiry_date)
    if manufacturing_date is not None and expiry_date is not None:
        try:
            validate_batch_dates(manufacturing_date, expiry_date)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    old_quantity = batch.available_quantity
    for field, val in dump.items():
        setattr(batch, field, val)

    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Re-sync expiry alert
    sync_batch_alert(db, batch)
    quantity_delta = batch.available_quantity - old_quantity
    if quantity_delta:
        db.add(InventoryMovement(
            hospital_id=batch.hospital_id, medicine_id=batch.medicine_id, batch_id=batch.id,
            user_id=current_user.id, movement_type="stock_adjustment", quantity_change=quantity_delta,
            reference=f"batch:{batch.id}", notes="Manual batch quantity adjustment",
        ))
    db.commit()

    log_audit_event(
        db=db,
        action="UPDATE_BATCH",
        entity_type="batch",
        entity_id=batch.id,
        user_id=current_user.id,
        details=dump
    )

    return batch


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a batch (Admin only)."""
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    db.delete(batch)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_BATCH",
        entity_type="batch",
        entity_id=batch_id,
        user_id=admin_user.id
    )
    return None
