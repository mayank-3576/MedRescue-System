from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.demand import DemandRecord
from app.models.hospital import Hospital
from app.models.medicine import Medicine
from app.models.user import User
from app.schemas.demand import DemandCreate, DemandUpdate, DemandResponse, DemandWithDetailsResponse
from app.auth.security import get_current_active_user
from app.auth.permissions import verify_hospital_access
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/demands", tags=["Demands"])


@router.get("", response_model=List[DemandWithDetailsResponse])
def list_demands(
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    priority: Optional[str] = None,
    is_active: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List hospital demand requisitions."""
    query = (
        db.query(DemandRecord)
        .join(Medicine, DemandRecord.medicine_id == Medicine.id)
        .join(Hospital, DemandRecord.hospital_id == Hospital.id)
    )

    if current_user.role == "staff":
        # Staff can view active demands across network for transfer matching,
        # but if hospital_id is passed, filter accordingly
        if hospital_id is not None:
            query = query.filter(DemandRecord.hospital_id == hospital_id)
    elif hospital_id is not None:
        query = query.filter(DemandRecord.hospital_id == hospital_id)

    if medicine_id is not None:
        query = query.filter(DemandRecord.medicine_id == medicine_id)
    if priority:
        query = query.filter(DemandRecord.priority == priority.lower())
    if is_active is not None:
        query = query.filter(DemandRecord.is_active == is_active)

    demands = query.order_by(desc(DemandRecord.created_at)).offset(skip).limit(limit).all()

    results = []
    for d in demands:
        results.append(DemandWithDetailsResponse(
            id=d.id,
            hospital_id=d.hospital_id,
            medicine_id=d.medicine_id,
            required_quantity=d.required_quantity,
            priority=d.priority,
            notes=d.notes,
            demand_date=d.demand_date,
            original_quantity=d.original_quantity,
            is_active=d.is_active,
            created_at=d.created_at,
            hospital_name=d.hospital.name if d.hospital else None,
            hospital_city=d.hospital.city if d.hospital else None,
            medicine_name=d.medicine.name if d.medicine else None,
            generic_name=d.medicine.generic_name if d.medicine else None,
            category=d.medicine.category if d.medicine else None,
            dosage_form=d.medicine.dosage_form if d.medicine else None,
            strength=d.medicine.strength if d.medicine else None,
        ))
    return results


@router.post("", response_model=DemandResponse, status_code=status.HTTP_201_CREATED)
def create_demand(
    data: DemandCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """File a medicine shortage demand requisition for a hospital."""
    verify_hospital_access(data.hospital_id, current_user)

    med = db.query(Medicine).filter(Medicine.id == data.medicine_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicine not found")

    demand_payload = data.model_dump()
    demand = DemandRecord(**demand_payload, original_quantity=demand_payload["required_quantity"])
    db.add(demand)
    db.commit()
    db.refresh(demand)

    log_audit_event(
        db=db,
        action="CREATE_DEMAND",
        entity_type="demand",
        entity_id=demand.id,
        user_id=current_user.id,
        details={"medicine_id": demand.medicine_id, "quantity": demand.required_quantity, "priority": demand.priority}
    )

    return demand


@router.put("/{demand_id}", response_model=DemandResponse)
def update_demand(
    demand_id: int,
    data: DemandUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update or cancel demand requisition."""
    demand = db.query(DemandRecord).filter(DemandRecord.id == demand_id).first()
    if not demand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demand not found")

    verify_hospital_access(demand.hospital_id, current_user)

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(demand, field, val)

    db.add(demand)
    db.commit()
    db.refresh(demand)

    log_audit_event(
        db=db,
        action="UPDATE_DEMAND",
        entity_type="demand",
        entity_id=demand.id,
        user_id=current_user.id,
        details=data.model_dump(exclude_unset=True)
    )

    return demand
