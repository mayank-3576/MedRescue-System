from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.models.hospital import Hospital
from app.models.staff_registration import StaffRegistrationRequest
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserWithHospitalResponse
from app.schemas.staff_registration import StaffRegistrationDecision, StaffRegistrationResponse
from app.auth.security import get_password_hash
from app.auth.permissions import require_admin
from app.services.audit_service import log_audit_event
from app.services.private_document_service import delete_private_document, read_private_document

router = APIRouter(prefix="/api/staff", tags=["Staff Management"])


@router.get("", response_model=List[UserWithHospitalResponse])
def list_staff(
    hospital_id: Optional[int] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List staff members and administrators (Admin only)."""
    query = db.query(User)
    if hospital_id is not None:
        query = query.filter(User.hospital_id == hospital_id)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for u in users:
        results.append(UserWithHospitalResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            hospital_id=u.hospital_id,
            is_active=u.is_active,
            created_at=u.created_at,
            updated_at=u.updated_at,
            hospital_name=u.hospital.name if u.hospital else None,
            hospital_city=u.hospital.city if u.hospital else None,
        ))
    return results


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    user_data: UserCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new staff user or administrator (Admin only)."""
    existing = db.query(User).filter(User.email == user_data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_data.email}' already exists"
        )

    if user_data.hospital_id:
        hosp = db.query(Hospital).filter(Hospital.id == user_data.hospital_id, Hospital.is_active.is_(True)).first()
        if not hosp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified hospital does not exist or is not verified and active")

    new_user = User(
        email=user_data.email.lower(),
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        hospital_id=user_data.hospital_id,
        is_active=user_data.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        action="CREATE_USER",
        entity_type="user",
        entity_id=new_user.id,
        user_id=admin_user.id,
        details={"email": new_user.email, "role": new_user.role, "hospital_id": new_user.hospital_id}
    )

    return new_user


def _registration_response(application: StaffRegistrationRequest) -> StaffRegistrationResponse:
    return StaffRegistrationResponse(
        id=application.id,
        full_name=application.full_name,
        email=application.email,
        hospital_id=application.hospital_id,
        hospital_name=application.hospital.name,
        hospital_city=application.hospital.city,
        government_id_type=application.government_id_type,
        status=application.status,
        submitted_at=application.submitted_at,
        reviewed_at=application.reviewed_at,
        review_note=application.review_note,
        government_id_verified=application.government_id_verified,
        hospital_authorization_verified=application.hospital_authorization_verified,
        government_id_document_viewed=application.government_id_document_viewed,
        authorization_document_viewed=application.authorization_document_viewed,
        government_id_document_available=bool(application.government_id_document_path),
        authorization_document_available=bool(application.authorization_document_path),
    )


@router.get("/registration-requests", response_model=list[StaffRegistrationResponse])
def list_staff_registration_requests(
    request_status: str = Query("pending", alias="status", pattern="^(pending|approved|rejected|all)$"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(StaffRegistrationRequest).options(joinedload(StaffRegistrationRequest.hospital))
    if request_status != "all":
        query = query.filter(StaffRegistrationRequest.status == request_status)
    applications = query.order_by(StaffRegistrationRequest.submitted_at.desc()).limit(200).all()
    return [_registration_response(application) for application in applications]


@router.get("/registration-requests/{request_id}/documents/{document_kind}")
def get_registration_document(
    request_id: int,
    document_kind: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    application = db.query(StaffRegistrationRequest).filter(
        StaffRegistrationRequest.id == request_id,
        StaffRegistrationRequest.status == "pending",
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Pending staff application not found")
    if document_kind == "government-id":
        document_path, mime_type = application.government_id_document_path, application.government_id_document_mime
    elif document_kind == "hospital-authorization":
        document_path, mime_type = application.authorization_document_path, application.authorization_document_mime
    else:
        raise HTTPException(status_code=404, detail="Verification document type not found")
    if not document_path or not mime_type:
        raise HTTPException(status_code=404, detail="Verification document is no longer available")
    document_content = read_private_document(document_path)
    if document_kind == "government-id":
        application.government_id_document_viewed = True
    else:
        application.authorization_document_viewed = True
    db.commit()
    return Response(
        content=document_content,
        media_type=mime_type,
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
        },
    )


@router.post("/registration-requests/{request_id}/decision", response_model=StaffRegistrationResponse)
def decide_staff_registration(
    request_id: int,
    decision: StaffRegistrationDecision,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    application = db.query(StaffRegistrationRequest).options(
        joinedload(StaffRegistrationRequest.hospital)
    ).filter(StaffRegistrationRequest.id == request_id).with_for_update().first()
    if not application:
        raise HTTPException(status_code=404, detail="Staff application not found")
    if application.status != "pending":
        raise HTTPException(status_code=409, detail="This staff application has already been reviewed")

    created_user_id = None
    if decision.decision == "approved":
        existing = db.query(User).filter(User.email == application.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="An account already exists for this email; review or reject this application")
        if not application.government_id_document_path or not application.authorization_document_path:
            raise HTTPException(status_code=409, detail="Both verification documents must be available before approval")
        if not (application.government_id_document_viewed and application.authorization_document_viewed):
            raise HTTPException(status_code=409, detail="Open both documents before approving this application")
        hospital = db.query(Hospital).filter(
            Hospital.id == application.hospital_id,
            Hospital.is_active.is_(True),
        ).first()
        if not hospital:
            raise HTTPException(status_code=409, detail="The selected hospital is no longer active")
        new_user = User(
            email=application.email,
            full_name=application.full_name,
            hashed_password=application.hashed_password,
            role="staff",
            hospital_id=application.hospital_id,
            is_active=True,
        )
        db.add(new_user)
        db.flush()
        created_user_id = new_user.id

    government_doc_path = application.government_id_document_path
    authorization_doc_path = application.authorization_document_path
    application.status = decision.decision
    application.reviewed_by = admin_user.id
    application.reviewed_at = datetime.utcnow()
    application.review_note = (decision.review_note or "").strip() or None
    application.government_id_verified = decision.decision == "approved" and decision.government_id_verified
    application.hospital_authorization_verified = decision.decision == "approved" and decision.hospital_authorization_verified
    application.government_id_document_path = None
    application.government_id_document_mime = None
    application.authorization_document_path = None
    application.authorization_document_mime = None
    db.commit()
    db.refresh(application)

    delete_private_document(government_doc_path)
    delete_private_document(authorization_doc_path)
    log_audit_event(
        db=db,
        action="REVIEW_STAFF_REGISTRATION",
        entity_type="staff_registration_request",
        entity_id=application.id,
        user_id=admin_user.id,
        details={
            "decision": application.status,
            "hospital_id": application.hospital_id,
            "government_id_verified": application.government_id_verified,
            "hospital_authorization_verified": application.hospital_authorization_verified,
            "created_user_id": created_user_id,
        },
    )
    return _registration_response(application)


@router.get("/{user_id}", response_model=UserWithHospitalResponse)
def get_staff_by_id(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get staff member details by user ID (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserWithHospitalResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        hospital_id=user.hospital_id,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        hospital_name=user.hospital.name if user.hospital else None,
        hospital_city=user.hospital.city if user.hospital else None,
    )


@router.put("/{user_id}", response_model=UserResponse)
def update_staff(
    user_id: int,
    update_data: UserUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update staff member profile, role, or credentials (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    dump = update_data.model_dump(exclude_unset=True)
    if dump.get("hospital_id"):
        hosp = db.query(Hospital).filter(Hospital.id == dump["hospital_id"], Hospital.is_active.is_(True)).first()
        if not hosp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified hospital does not exist or is not verified and active")
    if "password" in dump and dump["password"]:
        user.hashed_password = get_password_hash(dump.pop("password"))

    if "email" in dump and dump["email"]:
        dump["email"] = dump["email"].lower()
        other = db.query(User).filter(User.email == dump["email"], User.id != user_id).first()
        if other:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered to another user")

    for field, val in dump.items():
        setattr(user, field, val)

    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="UPDATE_USER",
        entity_type="user",
        entity_id=user.id,
        user_id=admin_user.id,
        details={"fields_updated": list(dump.keys())}
    )

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate staff member (Admin only)."""
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate own administrator account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    db.add(user)
    db.commit()

    log_audit_event(
        db=db,
        action="DEACTIVATE_USER",
        entity_type="user",
        entity_id=user.id,
        user_id=admin_user.id
    )
    return None
