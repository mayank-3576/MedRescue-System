from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.setting import ApplicationSetting
from app.models.user import User
from app.schemas.setting import SettingCreate, SettingUpdate, SettingResponse, SettingsBulkUpdate
from app.auth.security import get_current_active_user
from app.auth.permissions import require_admin
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/settings", tags=["Application Settings"])


@router.get("", response_model=List[SettingResponse])
def list_settings(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List operational settings."""
    query = db.query(ApplicationSetting)
    if category:
        query = query.filter(ApplicationSetting.category == category)
    settings = query.order_by(ApplicationSetting.category.asc(), ApplicationSetting.key.asc()).all()
    
    results = []
    for s in settings:
        results.append(SettingResponse(
            id=s.id,
            key=s.key,
            value=s.value,
            description=s.description,
            category=s.category,
            updated_by=s.updated_by,
            updated_at=s.updated_at,
            updated_by_name=s.updater.full_name if s.updater else None,
        ))
    return results


@router.get("/{key}", response_model=SettingResponse)
def get_setting(
    key: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get single application setting by key."""
    s = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")

    return SettingResponse(
        id=s.id,
        key=s.key,
        value=s.value,
        description=s.description,
        category=s.category,
        updated_by=s.updated_by,
        updated_at=s.updated_at,
        updated_by_name=s.updater.full_name if s.updater else None,
    )


@router.post("", response_model=SettingResponse, status_code=status.HTTP_201_CREATED)
def create_setting(
    data: SettingCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new configuration setting (Admin only)."""
    existing = db.query(ApplicationSetting).filter(ApplicationSetting.key == data.key).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Setting '{data.key}' already exists")

    s = ApplicationSetting(
        key=data.key,
        value=data.value,
        description=data.description,
        category=data.category,
        updated_by=admin_user.id,
        updated_at=datetime.utcnow(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)

    log_audit_event(
        db=db,
        action="CREATE_SETTING",
        entity_type="setting",
        entity_id=s.id,
        user_id=admin_user.id,
        details={"key": s.key, "value": s.value}
    )

    return SettingResponse(
        id=s.id,
        key=s.key,
        value=s.value,
        description=s.description,
        category=s.category,
        updated_by=s.updated_by,
        updated_at=s.updated_at,
        updated_by_name=admin_user.full_name,
    )


@router.put("", response_model=List[SettingResponse])
def update_settings_bulk(
    data: SettingsBulkUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Atomically update a set of existing operational configuration values."""
    keys = list(data.values)
    rows = db.query(ApplicationSetting).filter(ApplicationSetting.key.in_(keys)).all() if keys else []
    by_key = {row.key: row for row in rows}
    missing = set(keys) - set(by_key)
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown settings: {', '.join(sorted(missing))}")

    for key, value in data.values.items():
        by_key[key].value = value
        by_key[key].updated_by = admin_user.id
        by_key[key].updated_at = datetime.utcnow()
    db.commit()
    for row in rows:
        db.refresh(row)
    log_audit_event(
        db=db,
        action="UPDATE_SETTINGS",
        entity_type="setting",
        entity_id=None,
        user_id=admin_user.id,
        details={"keys": keys},
    )
    return [
        SettingResponse(
            id=row.id,
            key=row.key,
            value=row.value,
            description=row.description,
            category=row.category,
            updated_by=row.updated_by,
            updated_at=row.updated_at,
            updated_by_name=admin_user.full_name,
        )
        for row in rows
    ]


@router.put("/{key}", response_model=SettingResponse)
def update_setting(
    key: str,
    data: SettingUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update configuration setting value (Admin only)."""
    s = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")

    s.value = data.value
    if data.description is not None:
        s.description = data.description
    if data.category is not None:
        s.category = data.category
    s.updated_by = admin_user.id
    s.updated_at = datetime.utcnow()

    db.add(s)
    db.commit()
    db.refresh(s)

    log_audit_event(
        db=db,
        action="UPDATE_SETTING",
        entity_type="setting",
        entity_id=s.id,
        user_id=admin_user.id,
        details={"key": s.key, "new_value": s.value}
    )

    return SettingResponse(
        id=s.id,
        key=s.key,
        value=s.value,
        description=s.description,
        category=s.category,
        updated_by=s.updated_by,
        updated_at=s.updated_at,
        updated_by_name=admin_user.full_name,
    )
