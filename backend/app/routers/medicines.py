from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import get_db
from app.models.medicine import Medicine
from app.models.batch import MedicineBatch
from app.models.user import User
from app.schemas.medicine import MedicineCreate, MedicineUpdate, MedicineResponse, MedicineWithStockResponse
from app.schemas.batch import FEFOBatchResponse
from app.auth.security import get_current_active_user
from app.auth.permissions import require_admin
from app.services.fefo_service import get_fefo_ranked_batches
from app.services.expiry_service import calculate_days_remaining
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/medicines", tags=["Medicines"])


@router.get("", response_model=List[MedicineWithStockResponse])
def list_medicines(
    search: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List registered medicines with aggregated inventory counts and shelf-life indicators."""
    query = db.query(Medicine)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Medicine.name.ilike(search_pattern),
                Medicine.generic_name.ilike(search_pattern),
                Medicine.manufacturer.ilike(search_pattern),
                Medicine.barcode.ilike(search_pattern),
            )
        )
    if category:
        query = query.filter(Medicine.category.ilike(f"%{category}%"))

    medicines = query.order_by(Medicine.name.asc()).offset(skip).limit(limit).all()

    # Pre-aggregate stock for these medicines
    med_ids = [m.id for m in medicines]
    batch_q = db.query(MedicineBatch).filter(MedicineBatch.medicine_id.in_(med_ids), MedicineBatch.status == "active")

    # If user is hospital staff, restrict stock counts to their hospital
    if current_user.role == "staff" and current_user.hospital_id is not None:
        batch_q = batch_q.filter(MedicineBatch.hospital_id == current_user.hospital_id)

    batches = batch_q.all()
    batch_map = {}
    for b in batches:
        if b.medicine_id not in batch_map:
            batch_map[b.medicine_id] = []
        batch_map[b.medicine_id].append(b)

    results = []
    today = date.today()
    for m in medicines:
        m_batches = batch_map.get(m.id, [])
        total_avail = sum(b.available_quantity for b in m_batches)
        total_res = sum(b.reserved_quantity for b in m_batches)
        
        nearest_days = None
        if m_batches:
            valid_dates = [b.expiry_date for b in m_batches if b.expiry_date >= today]
            if valid_dates:
                nearest_expiry = min(valid_dates)
                nearest_days = (nearest_expiry - today).days

        results.append(MedicineWithStockResponse(
            id=m.id,
            name=m.name,
            generic_name=m.generic_name,
            dosage_form=m.dosage_form,
            strength=m.strength,
            manufacturer=m.manufacturer,
            category=m.category,
            barcode=m.barcode,
            unit_price=m.unit_price,
            min_stock_level=m.min_stock_level,
            requires_cold_chain=m.requires_cold_chain,
            created_at=m.created_at,
            updated_at=m.updated_at,
            total_available_stock=total_avail,
            total_reserved_stock=total_res,
            active_batches_count=len(m_batches),
            nearest_expiry_days=nearest_days,
        ))

    return results


@router.get("/by-barcode/{barcode}", response_model=MedicineWithStockResponse)
def get_medicine_by_barcode(
    barcode: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lookup medicine specifications by barcode. Used by barcode scanners in catalog and batch entry."""
    cleaned = barcode.strip()
    medicine = db.query(Medicine).filter(func.lower(Medicine.barcode) == cleaned.lower()).first()
    if not medicine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No medicine found with barcode '{cleaned}' in the master catalog.",
        )

    batch_q = db.query(MedicineBatch).filter(MedicineBatch.medicine_id == medicine.id, MedicineBatch.status == "active")
    if current_user.role == "staff" and current_user.hospital_id:
        batch_q = batch_q.filter(MedicineBatch.hospital_id == current_user.hospital_id)

    batches = batch_q.all()
    total_avail = sum(b.available_quantity for b in batches)
    total_res = sum(b.reserved_quantity for b in batches)

    today = date.today()
    valid_dates = [b.expiry_date for b in batches if b.expiry_date >= today]
    nearest_days = min([(d - today).days for d in valid_dates]) if valid_dates else None

    return MedicineWithStockResponse(
        id=medicine.id,
        name=medicine.name,
        generic_name=medicine.generic_name,
        dosage_form=medicine.dosage_form,
        strength=medicine.strength,
        manufacturer=medicine.manufacturer,
        category=medicine.category,
        barcode=medicine.barcode,
        unit_price=medicine.unit_price,
        min_stock_level=medicine.min_stock_level,
        requires_cold_chain=medicine.requires_cold_chain,
        created_at=medicine.created_at,
        updated_at=medicine.updated_at,
        total_available_stock=total_avail,
        total_reserved_stock=total_res,
        active_batches_count=len(batches),
        nearest_expiry_days=nearest_days,
    )


@router.get("/{medicine_id}", response_model=MedicineWithStockResponse)
def get_medicine(
    medicine_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve details for a single medicine."""
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine not found")

    batch_q = db.query(MedicineBatch).filter(MedicineBatch.medicine_id == medicine_id, MedicineBatch.status == "active")
    if current_user.role == "staff" and current_user.hospital_id:
        batch_q = batch_q.filter(MedicineBatch.hospital_id == current_user.hospital_id)

    batches = batch_q.all()
    total_avail = sum(b.available_quantity for b in batches)
    total_res = sum(b.reserved_quantity for b in batches)

    today = date.today()
    valid_dates = [b.expiry_date for b in batches if b.expiry_date >= today]
    nearest_days = min([(d - today).days for d in valid_dates]) if valid_dates else None

    return MedicineWithStockResponse(
        id=medicine.id,
        name=medicine.name,
        generic_name=medicine.generic_name,
        dosage_form=medicine.dosage_form,
        strength=medicine.strength,
        manufacturer=medicine.manufacturer,
        category=medicine.category,
        barcode=medicine.barcode,
        unit_price=medicine.unit_price,
        min_stock_level=medicine.min_stock_level,
        requires_cold_chain=medicine.requires_cold_chain,
        created_at=medicine.created_at,
        updated_at=medicine.updated_at,
        total_available_stock=total_avail,
        total_reserved_stock=total_res,
        active_batches_count=len(batches),
        nearest_expiry_days=nearest_days,
    )


@router.get("/{medicine_id}/fefo")
def get_medicine_fefo_batches(
    medicine_id: int,
    quantity: Optional[int] = Query(None, ge=1),
    hospital_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get FEFO (First-Expired, First-Out) ranked list of batches for dispensing.
    """
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine not found")

    # If staff user, enforce their hospital
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    fefo_res = get_fefo_ranked_batches(
        db=db,
        medicine_id=medicine_id,
        hospital_id=hosp_filter,
        required_quantity=quantity,
    )
    return fefo_res


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def create_medicine(
    medicine_data: MedicineCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Add a new medicine to the master catalog (Admin only)."""
    payload = medicine_data.model_dump()
    payload["barcode"] = (payload.get("barcode") or "").strip() or None
    if payload["barcode"] and db.query(Medicine).filter(Medicine.barcode == payload["barcode"]).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This barcode is already assigned to another medicine")
    medicine = Medicine(**payload)
    db.add(medicine)
    db.commit()
    db.refresh(medicine)

    log_audit_event(
        db=db,
        action="CREATE_MEDICINE",
        entity_type="medicine",
        entity_id=medicine.id,
        user_id=admin_user.id,
        details={"name": medicine.name, "category": medicine.category}
    )

    return medicine


@router.put("/{medicine_id}", response_model=MedicineResponse)
def update_medicine(
    medicine_id: int,
    update_data: MedicineUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update medicine specifications in catalog (Admin only)."""
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine not found")

    updates = update_data.model_dump(exclude_unset=True)
    if "barcode" in updates:
        updates["barcode"] = (updates["barcode"] or "").strip() or None
        if updates["barcode"] and db.query(Medicine).filter(Medicine.barcode == updates["barcode"], Medicine.id != medicine_id).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This barcode is already assigned to another medicine")
    for field, val in updates.items():
        setattr(medicine, field, val)

    db.add(medicine)
    db.commit()
    db.refresh(medicine)

    log_audit_event(
        db=db,
        action="UPDATE_MEDICINE",
        entity_type="medicine",
        entity_id=medicine.id,
        user_id=admin_user.id,
        details=updates
    )

    return medicine


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(
    medicine_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a medicine from catalog (Admin only)."""
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine not found")

    db.delete(medicine)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_MEDICINE",
        entity_type="medicine",
        entity_id=medicine_id,
        user_id=admin_user.id
    )
    return None
