from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.security import get_current_active_user
from app.database import get_db
from app.models.inventory_movement import InventoryMovement
from app.models.user import User

router = APIRouter(prefix="/api/inventory/movements", tags=["Inventory Movements"])


class MovementResponse(BaseModel):
    id: int
    hospital_id: int
    medicine_id: int
    batch_id: Optional[int]
    user_id: Optional[int]
    movement_type: str
    quantity_change: int
    reference: Optional[str]
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[MovementResponse])
def list_movements(
    hospital_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryMovement)
    if current_user.role == "staff":
        query = query.filter(InventoryMovement.hospital_id == current_user.hospital_id)
    elif hospital_id is not None:
        query = query.filter(InventoryMovement.hospital_id == hospital_id)
    if batch_id is not None:
        query = query.filter(InventoryMovement.batch_id == batch_id)
    return query.order_by(InventoryMovement.created_at.desc()).limit(limit).all()
