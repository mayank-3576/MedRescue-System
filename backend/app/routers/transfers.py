from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db
from app.models.transfer import TransferRequest
from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.transfer import (
    TransferCreate, TransferUpdate, TransferApprove, TransferDispatch,
    TransferReceive, TransferCancel, TransferResponse, TransferDetailResponse
)
from app.auth.security import get_current_active_user
from app.services.transfer_service import (
    create_transfer_request,
    approve_transfer_request,
    reject_transfer_request,
    dispatch_transfer_request,
    receive_transfer_request,
    cancel_transfer_request,
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


def format_transfer_detail(t: TransferRequest) -> TransferDetailResponse:
    batch = t.batch
    med = t.medicine
    src = t.source_hospital
    dst = t.destination_hospital
    unit_mrp = batch.unit_mrp if batch else 0.0
    effective_qty = t.received_quantity or t.approved_quantity or t.requested_quantity
    tot_val = round(effective_qty * unit_mrp, 2)

    return TransferDetailResponse(
        id=t.id,
        source_hospital_id=t.source_hospital_id,
        destination_hospital_id=t.destination_hospital_id,
        batch_id=t.batch_id,
        medicine_id=t.medicine_id,
        requested_quantity=t.requested_quantity,
        urgency=t.urgency,
        approved_quantity=t.approved_quantity,
        dispatched_quantity=t.dispatched_quantity,
        received_quantity=t.received_quantity,
        status=t.status,
        route_distance_km=t.route_distance_km,
        delivery_cost=t.delivery_cost,
        is_road_distance=t.is_road_distance,
        requested_by=t.requested_by,
        approved_by=t.approved_by,
        notes=t.notes,
        created_at=t.created_at,
        updated_at=t.updated_at,
        source_hospital_name=src.name if src else None,
        source_hospital_city=src.city if src else None,
        destination_hospital_name=dst.name if dst else None,
        destination_hospital_city=dst.city if dst else None,
        medicine_name=med.name if med else None,
        generic_name=med.generic_name if med else None,
        batch_number=batch.batch_number if batch else None,
        unit_mrp=unit_mrp,
        total_transfer_value=tot_val,
        requester_name=t.requester.full_name if t.requester else None,
        approver_name=t.approver.full_name if t.approver else None,
    )


@router.get("", response_model=List[TransferDetailResponse])
def list_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    hospital_id: Optional[int] = None,
    medicine_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List transfer requests.
    - Staff accounts see transfers involving their hospital (as sender or receiver).
    - Admins see all transfers across the network.
    """
    query = (
        db.query(TransferRequest)
        .join(Medicine, TransferRequest.medicine_id == Medicine.id)
        .join(MedicineBatch, TransferRequest.batch_id == MedicineBatch.id)
    )

    if current_user.role == "staff":
        query = query.filter(
            or_(
                TransferRequest.source_hospital_id == current_user.hospital_id,
                TransferRequest.destination_hospital_id == current_user.hospital_id,
            )
        )
    elif hospital_id is not None:
        query = query.filter(
            or_(
                TransferRequest.source_hospital_id == hospital_id,
                TransferRequest.destination_hospital_id == hospital_id,
            )
        )

    if status_filter:
        query = query.filter(TransferRequest.status == status_filter.lower())
    if medicine_id is not None:
        query = query.filter(TransferRequest.medicine_id == medicine_id)

    transfers = query.order_by(desc(TransferRequest.created_at)).offset(skip).limit(limit).all()
    return [format_transfer_detail(t) for t in transfers]


@router.get("/{transfer_id}", response_model=TransferDetailResponse)
def get_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get single transfer request details."""
    t = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff":
        if current_user.hospital_id not in (t.source_hospital_id, t.destination_hospital_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view transfers for this hospital"
            )

    return format_transfer_detail(t)


@router.post("", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(
    data: TransferCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Initiate a transfer request between hospitals."""
    # Enforce staff can only request for or from their hospital
    if current_user.role == "staff":
        if current_user.hospital_id != data.source_hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create transfers involving your designated hospital"
            )

    transfer = create_transfer_request(
        db=db,
        source_hospital_id=data.source_hospital_id,
        destination_hospital_id=data.destination_hospital_id,
        batch_id=data.batch_id,
        medicine_id=data.medicine_id,
        requested_quantity=data.requested_quantity,
        urgency=data.urgency,
        requested_by_user=current_user,
        notes=data.notes,
        initial_status="pending_approval"
    )

    log_audit_event(
        db=db,
        action="CREATE_TRANSFER",
        entity_type="transfer",
        entity_id=transfer.id,
        user_id=current_user.id,
        details={
            "source": transfer.source_hospital_id,
            "dest": transfer.destination_hospital_id,
            "quantity": transfer.requested_quantity,
        }
    )

    return transfer


@router.post("/{transfer_id}/approve", response_model=TransferResponse)
def approve_transfer(
    transfer_id: int,
    approve_data: TransferApprove,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Approve transfer request and reserve source batch stock.
    Only authorized source hospital staff or administrators may approve.
    """
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff" and current_user.hospital_id != transfer.source_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff of the dispensing source hospital or admins can approve this transfer"
        )

    updated = approve_transfer_request(
        db=db,
        transfer=transfer,
        approved_quantity=approve_data.approved_quantity,
        approved_by_user=current_user,
        notes=approve_data.notes,
    )

    log_audit_event(
        db=db,
        action="APPROVE_TRANSFER",
        entity_type="transfer",
        entity_id=updated.id,
        user_id=current_user.id,
        details={"approved_quantity": approve_data.approved_quantity}
    )

    return updated


@router.post("/{transfer_id}/reject", response_model=TransferResponse)
def reject_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    reason: Optional[str] = Query(None),
):
    """Reject a pending transfer request."""
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff" and current_user.hospital_id != transfer.source_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only source hospital staff or admins can reject this transfer"
        )

    updated = reject_transfer_request(
        db=db,
        transfer=transfer,
        rejected_by_user=current_user,
        reason=reason,
    )

    log_audit_event(
        db=db,
        action="REJECT_TRANSFER",
        entity_type="transfer",
        entity_id=updated.id,
        user_id=current_user.id,
        details={"reason": reason}
    )

    return updated


@router.post("/{transfer_id}/dispatch", response_model=TransferResponse)
def dispatch_transfer(
    transfer_id: int,
    dispatch_data: TransferDispatch,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark an approved transfer as dispatched for transit."""
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff" and current_user.hospital_id != transfer.source_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only source hospital staff or admins can dispatch this transfer"
        )

    updated = dispatch_transfer_request(
        db=db,
        transfer=transfer,
        dispatched_quantity=dispatch_data.dispatched_quantity,
        notes=dispatch_data.notes,
    )

    log_audit_event(
        db=db,
        action="DISPATCH_TRANSFER",
        entity_type="transfer",
        entity_id=updated.id,
        user_id=current_user.id,
        details={"dispatched_quantity": updated.dispatched_quantity}
    )

    return updated


@router.post("/{transfer_id}/receive", response_model=TransferResponse)
def receive_transfer(
    transfer_id: int,
    receive_data: TransferReceive,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Confirm delivery receipt at destination hospital. Replenishes receiving hospital inventory.
    """
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff" and current_user.hospital_id != transfer.destination_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only recipient destination hospital staff or admins can receive this shipment"
        )

    updated = receive_transfer_request(
        db=db,
        transfer=transfer,
        received_quantity=receive_data.received_quantity,
        notes=receive_data.notes,
    )

    log_audit_event(
        db=db,
        action="RECEIVE_TRANSFER",
        entity_type="transfer",
        entity_id=updated.id,
        user_id=current_user.id,
        details={"received_quantity": updated.received_quantity}
    )

    return updated


@router.post("/{transfer_id}/cancel", response_model=TransferResponse)
def cancel_transfer(
    transfer_id: int,
    cancel_data: TransferCancel,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Cancel transfer and release any reserved stock back to available inventory."""
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found")

    if current_user.role == "staff":
        if current_user.hospital_id not in (transfer.source_hospital_id, transfer.destination_hospital_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot cancel transfers for other hospitals"
            )

    updated = cancel_transfer_request(
        db=db,
        transfer=transfer,
        reason=cancel_data.reason,
    )

    log_audit_event(
        db=db,
        action="CANCEL_TRANSFER",
        entity_type="transfer",
        entity_id=updated.id,
        user_id=current_user.id,
        details={"reason": cancel_data.reason}
    )

    return updated
