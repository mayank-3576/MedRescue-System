from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User
from app.models.batch import MedicineBatch
from app.schemas.rescue import RescueEngineRunResponse, RescueRecommendationItem
from app.schemas.transfer import TransferResponse
from app.auth.security import get_current_active_user
from app.auth.permissions import verify_hospital_access
from app.services.rescue_service import run_rescue_engine
from app.services.transfer_service import create_transfer_request
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/rescue", tags=["Rescue Engine"])


class RescueExecuteRequest(BaseModel):
    batch_id: int
    destination_hospital_id: int
    quantity: int = Field(gt=0)
    notes: Optional[str] = None


@router.get("/recommendations", response_model=RescueEngineRunResponse)
def get_rescue_recommendations(
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    max_days_ahead: int = Query(90, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Run the 7-step MedRescue System engine to generate ranked redistribution recommendations
    preventing drug expiration and mitigating hospital stockouts.
    """
    hosp_filter = hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    result = run_rescue_engine(
        db=db,
        hospital_id=hosp_filter,
        medicine_id=medicine_id,
        max_days_ahead=max_days_ahead,
        limit=limit,
    )
    return result


@router.post("/execute", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def execute_rescue_transfer(
    exec_data: RescueExecuteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Directly execute an approved rescue recommendation by creating a pending transfer request.
    """
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == exec_data.batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    verify_hospital_access(batch.hospital_id, current_user)

    transfer = create_transfer_request(
        db=db,
        source_hospital_id=batch.hospital_id,
        destination_hospital_id=exec_data.destination_hospital_id,
        batch_id=batch.id,
        medicine_id=batch.medicine_id,
        requested_quantity=exec_data.quantity,
        requested_by_user=current_user,
        notes=exec_data.notes or "Initiated from AI Rescue Recommendation",
        initial_status="pending_approval"
    )

    log_audit_event(
        db=db,
        action="EXECUTE_RESCUE_RECOMMENDATION",
        entity_type="transfer",
        entity_id=transfer.id,
        user_id=current_user.id,
        details={
            "batch_id": batch.id,
            "quantity": exec_data.quantity,
            "source_hospital_id": batch.hospital_id,
            "dest_hospital_id": exec_data.destination_hospital_id
        }
    )

    return transfer
