from datetime import timedelta
from pathlib import Path
import re
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.hospital import Hospital
from app.models.staff_registration import StaffRegistrationRequest
from app.schemas.auth import Token, LoginRequest, PasswordChangeRequest
from app.schemas.user import UserWithHospitalResponse
from app.schemas.staff_registration import RegistrationHospitalResponse
from app.auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user,
)
from app.services.audit_service import log_audit_event
from app.services.private_document_service import encrypt_private_upload

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
EMAIL_ADAPTER = TypeAdapter(EmailStr)
GOVERNMENT_ID_TYPES = {"aadhaar_masked", "pan", "voter_id", "passport", "driving_license", "other"}


def _raise_for_pending_application(db: Session, email: str, password: str) -> None:
    application = db.query(StaffRegistrationRequest).filter(
        func.lower(StaffRegistrationRequest.email) == email.lower(),
        StaffRegistrationRequest.status == "pending",
    ).first()
    if application and verify_password(password, application.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your staff account is waiting for administrator verification.",
        )


@router.get("/registration-hospitals", response_model=list[RegistrationHospitalResponse])
def list_registration_hospitals(db: Session = Depends(get_db)):
    """Expose only the small set of active facility fields needed by signup."""
    hospitals = db.query(Hospital).filter(Hospital.is_active.is_(True)).order_by(Hospital.name.asc()).all()
    return [RegistrationHospitalResponse(id=h.id, name=h.name, city=h.city, state=h.state) for h in hospitals]


@router.post("/register-staff", status_code=status.HTTP_202_ACCEPTED)
def register_hospital_staff(
    request: Request,
    full_name: str = Form(..., min_length=2, max_length=160),
    email: str = Form(..., min_length=5, max_length=255),
    password: str = Form(..., min_length=12, max_length=128),
    hospital_id: int = Form(..., gt=0),
    government_id_type: str = Form(...),
    government_id_document: UploadFile = File(...),
    hospital_authorization_document: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Create a pending application; only an admin can activate a staff account."""
    full_name = full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(status_code=422, detail="Enter the applicant's full name")
    try:
        normalized_email = str(EMAIL_ADAPTER.validate_python(email.strip())).lower()
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Enter a valid email address; this will be your login ID") from exc
    if not (re.search(r"[A-Z]", password) and re.search(r"[a-z]", password) and re.search(r"\d", password)):
        raise HTTPException(status_code=422, detail="Password must contain uppercase, lowercase, and number characters")

    government_id_type = government_id_type.strip().lower()
    if government_id_type not in GOVERNMENT_ID_TYPES:
        raise HTTPException(status_code=422, detail="Select a supported government-issued photo ID type")
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active.is_(True)).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Choose an active hospital in the network")
    if db.query(User.id).filter(func.lower(User.email) == normalized_email).first():
        raise HTTPException(status_code=409, detail="This email already has an account. Sign in or contact an administrator.")
    if db.query(StaffRegistrationRequest.id).filter(
        func.lower(StaffRegistrationRequest.email) == normalized_email,
        StaffRegistrationRequest.status == "pending",
    ).first():
        raise HTTPException(status_code=409, detail="An application for this email is already awaiting review")

    government_doc_path = None
    authorization_doc_path = None
    try:
        government_doc_path, government_doc_mime = encrypt_private_upload(government_id_document)
        authorization_doc_path, authorization_doc_mime = encrypt_private_upload(hospital_authorization_document)
        application = StaffRegistrationRequest(
            full_name=full_name,
            email=normalized_email,
            hashed_password=get_password_hash(password),
            hospital_id=hospital.id,
            government_id_type=government_id_type,
            government_id_document_path=government_doc_path,
            government_id_document_mime=government_doc_mime,
            authorization_document_path=authorization_doc_path,
            authorization_document_mime=authorization_doc_mime,
            status="pending",
        )
        db.add(application)
        db.commit()
        db.refresh(application)
    except Exception:
        db.rollback()
        for path in (government_doc_path, authorization_doc_path):
            if path:
                Path(path).unlink(missing_ok=True)
        raise

    log_audit_event(
        db=db,
        action="SUBMIT_STAFF_REGISTRATION",
        entity_type="staff_registration_request",
        entity_id=application.id,
        details={"hospital_id": hospital.id, "government_id_type": government_id_type},
        ip_address=request.client.host if request.client else None,
    )
    return {
        "application_id": application.id,
        "status": application.status,
        "message": "Application submitted. An administrator must verify the government ID and hospital authorization before login is enabled.",
    }


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2 compatible token login. Accepts username (email) and password.
    """
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user:
        _raise_for_pending_application(db, form_data.username, form_data.password)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact system administrator."
        )

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": user.email,
        "role": user.role,
        "hospital_id": user.hospital_id,
        "user_id": user.id,
    }
    access_token = create_access_token(data=token_payload, expires_delta=expires_delta)

    # Log audit event
    client_ip = request.client.host if request.client else None
    log_audit_event(
        db=db,
        action="USER_LOGIN",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details={"email": user.email, "role": user.role},
        ip_address=client_ip
    )

    user_info = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "hospital_id": user.hospital_id,
        "hospital_name": user.hospital.name if user.hospital else None,
        "hospital_city": user.hospital.city if user.hospital else None,
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_info,
    }


@router.post("/login-json", response_model=Token)
def login_json(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    JSON payload login endpoint for web frontend applications.
    """
    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    if not user:
        _raise_for_pending_application(db, str(login_data.email), login_data.password)
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": user.email,
        "role": user.role,
        "hospital_id": user.hospital_id,
        "user_id": user.id,
    }
    access_token = create_access_token(data=token_payload, expires_delta=expires_delta)

    client_ip = request.client.host if request.client else None
    log_audit_event(
        db=db,
        action="USER_LOGIN_JSON",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details={"email": user.email, "role": user.role},
        ip_address=client_ip
    )

    user_info = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "hospital_id": user.hospital_id,
        "hospital_name": user.hospital.name if user.hospital else None,
        "hospital_city": user.hospital.city if user.hospital else None,
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_info,
    }


@router.get("/me", response_model=UserWithHospitalResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """Get authenticated user's profile and hospital affiliation."""
    return UserWithHospitalResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        hospital_id=current_user.hospital_id,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        hospital_name=current_user.hospital.name if current_user.hospital else None,
        hospital_city=current_user.hospital.city if current_user.hospital else None,
    )


@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change current authenticated user's password."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed"
        )

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.add(current_user)
    db.commit()

    log_audit_event(
        db=db,
        action="CHANGE_PASSWORD",
        entity_type="user",
        entity_id=current_user.id,
        user_id=current_user.id,
    )

    return {"message": "Password updated successfully"}


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Logout endpoint to record session termination in audit log."""
    log_audit_event(
        db=db,
        action="USER_LOGOUT",
        entity_type="user",
        entity_id=current_user.id,
        user_id=current_user.id
    )
    return {"message": "Successfully logged out"}
