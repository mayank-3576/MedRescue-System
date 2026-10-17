from datetime import datetime, date
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transfer import TransferRequest
from app.models.batch import MedicineBatch
from app.models.hospital import Hospital
from app.models.medicine import Medicine
from app.models.demand import DemandRecord
from app.models.delivery import DeliveryEstimate
from app.models.user import User
from app.models.inventory_movement import InventoryMovement
from app.services.delivery_service import calculate_route_sync, get_delivery_rates
from app.services.expiry_service import sync_batch_alert

# Valid state machine transitions
VALID_TRANSITIONS = {
    "draft": ["pending_approval", "cancelled"],
    "pending_approval": ["approved", "rejected", "cancelled"],
    "approved": ["dispatched", "cancelled"],
    "dispatched": ["received"],
    "rejected": [],
    "received": [],
    "cancelled": [],
}


def create_transfer_request(
    db: Session,
    source_hospital_id: int,
    destination_hospital_id: int,
    batch_id: int,
    medicine_id: int,
    requested_quantity: int,
    urgency: str = "routine",
    requested_by_user: Optional[User] = None,
    notes: Optional[str] = None,
    initial_status: str = "pending_approval",
) -> TransferRequest:
    """Create a new transfer request with automated routing and cost calculation."""
    if source_hospital_id == destination_hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination hospitals cannot be the same"
        )

    # Validate source hospital
    src_hosp = db.query(Hospital).filter(Hospital.id == source_hospital_id, Hospital.is_active == True).first()
    if not src_hosp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source hospital not found or inactive")

    # Validate destination hospital
    dst_hosp = db.query(Hospital).filter(Hospital.id == destination_hospital_id, Hospital.is_active == True).first()
    if not dst_hosp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination hospital not found or inactive")

    # Validate batch
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    if batch.hospital_id != source_hospital_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch does not belong to source hospital")
    if batch.medicine_id != medicine_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Medicine does not match the selected batch")

    if batch.status != "active" or batch.expiry_date <= date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot transfer batch in '{batch.status}' status")

    # available_quantity is the unreserved stock; reserved_quantity is tracked separately.
    available = batch.available_quantity
    if available < requested_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested quantity ({requested_quantity}) exceeds unreserved stock ({available})"
        )

    # Route & distance calculation
    route_info = calculate_route_sync(
        src_hosp.latitude, src_hosp.longitude, dst_hosp.latitude, dst_hosp.longitude, db=db
    )

    transfer = TransferRequest(
        source_hospital_id=source_hospital_id,
        destination_hospital_id=destination_hospital_id,
        batch_id=batch_id,
        medicine_id=medicine_id,
        requested_quantity=requested_quantity,
        urgency=urgency,
        status=initial_status,
        route_distance_km=route_info["distance_km"],
        delivery_cost=route_info["estimated_cost"],
        is_road_distance=route_info["is_road_distance"],
        requested_by=requested_by_user.id if requested_by_user else None,
        notes=notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(transfer)
    db.flush()

    # Create associated DeliveryEstimate record
    cost_per_km, fixed_charge = get_delivery_rates(db)
    delivery_est = DeliveryEstimate(
        transfer_id=transfer.id,
        source_hospital_id=source_hospital_id,
        destination_hospital_id=destination_hospital_id,
        distance_km=route_info["distance_km"],
        is_road_distance=route_info["is_road_distance"],
        cost_per_km=cost_per_km,
        fixed_charge=fixed_charge,
        estimated_cost=route_info["estimated_cost"],
        created_at=datetime.utcnow(),
    )
    db.add(delivery_est)
    db.commit()
    db.refresh(transfer)
    return transfer


def approve_transfer_request(
    db: Session,
    transfer: TransferRequest,
    approved_quantity: int,
    approved_by_user: Optional[User] = None,
    notes: Optional[str] = None
) -> TransferRequest:
    """Approve a transfer request and reserve physical stock in the source batch."""
    if "approved" not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition transfer from '{transfer.status}' to 'approved'"
        )

    batch = db.query(MedicineBatch).filter(MedicineBatch.id == transfer.batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    if approved_quantity <= 0 or approved_quantity > transfer.requested_quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approved quantity must be positive and cannot exceed the requested quantity")
    if batch.status != "active" or batch.expiry_date <= date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch is no longer eligible for transfer")
    if batch.available_quantity < approved_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient available stock ({batch.available_quantity}) for approved quantity ({approved_quantity})"
        )

    # Reserve inventory
    batch.available_quantity -= approved_quantity
    batch.reserved_quantity += approved_quantity
    db.add(batch)

    transfer.status = "approved"
    transfer.approved_quantity = approved_quantity
    if approved_by_user:
        transfer.approved_by = approved_by_user.id
    if notes:
        transfer.notes = f"{transfer.notes or ''} [Approval Note]: {notes}".strip()
    transfer.updated_at = datetime.utcnow()

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    sync_batch_alert(db, batch)
    return transfer


def reject_transfer_request(
    db: Session,
    transfer: TransferRequest,
    rejected_by_user: Optional[User] = None,
    reason: Optional[str] = None
) -> TransferRequest:
    """Reject a pending transfer request."""
    if "rejected" not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition transfer from '{transfer.status}' to 'rejected'"
        )

    transfer.status = "rejected"
    if rejected_by_user:
        transfer.approved_by = rejected_by_user.id
    if reason:
        transfer.notes = f"{transfer.notes or ''} [Rejection Reason]: {reason}".strip()
    transfer.updated_at = datetime.utcnow()

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def dispatch_transfer_request(
    db: Session,
    transfer: TransferRequest,
    dispatched_quantity: Optional[int] = None,
    notes: Optional[str] = None
) -> TransferRequest:
    """Mark an approved transfer as dispatched, deducting reserved inventory from source hospital."""
    if "dispatched" not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition transfer from '{transfer.status}' to 'dispatched'"
        )

    batch = db.query(MedicineBatch).filter(MedicineBatch.id == transfer.batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    qty = dispatched_quantity if dispatched_quantity is not None else transfer.approved_quantity
    if qty <= 0 or qty > transfer.approved_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dispatched quantity ({qty}) must be > 0 and <= approved quantity ({transfer.approved_quantity})"
        )

    # Deduct from reserved inventory (stock leaves hospital)
    batch.reserved_quantity -= transfer.approved_quantity
    # If partial dispatch, return remainder to available
    remainder = transfer.approved_quantity - qty
    if remainder > 0:
        batch.available_quantity += remainder
    db.add(batch)
    db.add(InventoryMovement(
        hospital_id=transfer.source_hospital_id, medicine_id=transfer.medicine_id, batch_id=batch.id,
        movement_type="transfer_dispatch", quantity_change=-qty,
        reference=f"transfer:{transfer.id}", notes="Stock dispatched to receiving hospital",
    ))

    transfer.status = "dispatched"
    transfer.dispatched_quantity = qty
    if notes:
        transfer.notes = f"{transfer.notes or ''} [Dispatch Note]: {notes}".strip()
    transfer.updated_at = datetime.utcnow()

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def receive_transfer_request(
    db: Session,
    transfer: TransferRequest,
    received_quantity: Optional[int] = None,
    notes: Optional[str] = None
) -> TransferRequest:
    """
    Mark a dispatched transfer as received. Stock is credited to the destination hospital's inventory.
    """
    if "received" not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition transfer from '{transfer.status}' to 'received'"
        )

    source_batch = db.query(MedicineBatch).filter(MedicineBatch.id == transfer.batch_id).first()
    if not source_batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source batch not found")

    qty = received_quantity if received_quantity is not None else transfer.dispatched_quantity
    if qty <= 0 or qty > transfer.dispatched_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received quantity must be greater than zero and cannot exceed the dispatched quantity"
        )

    if source_batch.expiry_date <= date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expired stock cannot be received as a completed rescue transfer")

    # Check if destination hospital already has this batch number
    dest_batch = (
        db.query(MedicineBatch)
        .filter(
            MedicineBatch.hospital_id == transfer.destination_hospital_id,
            MedicineBatch.batch_number == source_batch.batch_number,
        )
        .first()
    )

    if dest_batch:
        dest_batch.available_quantity += qty
        dest_batch.status = "active"
        db.add(dest_batch)
    else:
        # Create a new batch entry for the receiving hospital
        dest_batch = MedicineBatch(
            medicine_id=source_batch.medicine_id,
            hospital_id=transfer.destination_hospital_id,
            batch_number=source_batch.batch_number,
            available_quantity=qty,
            reserved_quantity=0,
            unit_mrp=source_batch.unit_mrp,
            unit_purchase_cost=source_batch.unit_purchase_cost,
            manufacturing_date=source_batch.manufacturing_date,
            expiry_date=source_batch.expiry_date,
            storage_requirements=source_batch.storage_requirements,
            status="active",
            is_demo=source_batch.is_demo,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(dest_batch)
        db.flush()

    db.add(InventoryMovement(
        hospital_id=transfer.destination_hospital_id, medicine_id=transfer.medicine_id, batch_id=dest_batch.id,
        movement_type="transfer_receipt", quantity_change=qty,
        reference=f"transfer:{transfer.id}", notes="Stock received from sending hospital",
    ))

    # Synchronize expiry alert for receiving hospital's new/updated batch
    sync_batch_alert(db, dest_batch)

    # Fulfill matching active demand if any exists at destination hospital
    matching_demand = (
        db.query(DemandRecord)
        .filter(
            DemandRecord.hospital_id == transfer.destination_hospital_id,
            DemandRecord.medicine_id == transfer.medicine_id,
            DemandRecord.is_active == True,
        )
        .first()
    )
    if matching_demand:
        if matching_demand.required_quantity <= qty:
            matching_demand.is_active = False
        else:
            matching_demand.required_quantity -= qty
        db.add(matching_demand)

    transfer.status = "received"
    transfer.received_quantity = qty
    if notes:
        transfer.notes = f"{transfer.notes or ''} [Receive Note]: {notes}".strip()
    transfer.updated_at = datetime.utcnow()

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def cancel_transfer_request(
    db: Session,
    transfer: TransferRequest,
    reason: Optional[str] = None
) -> TransferRequest:
    """Cancel a transfer request and release reserved stock if it was approved."""
    if "cancelled" not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel transfer in '{transfer.status}' status"
        )

    # If it was approved, release the reserved stock
    if transfer.status == "approved" and transfer.approved_quantity > 0:
        batch = db.query(MedicineBatch).filter(MedicineBatch.id == transfer.batch_id).first()
        if batch:
            batch.reserved_quantity = max(0, batch.reserved_quantity - transfer.approved_quantity)
            batch.available_quantity += transfer.approved_quantity
            db.add(batch)
            sync_batch_alert(db, batch)

    transfer.status = "cancelled"
    if reason:
        transfer.notes = f"{transfer.notes or ''} [Cancellation]: {reason}".strip()
    transfer.updated_at = datetime.utcnow()

    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer
