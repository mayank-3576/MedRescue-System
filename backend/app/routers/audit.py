from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.auth.permissions import require_admin

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])


@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retrieve operational audit trail logs (Admin only)."""
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditLog.entity_id == entity_id)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

    results = []
    for l in logs:
        results.append(AuditLogResponse(
            id=l.id,
            user_id=l.user_id,
            action=l.action,
            entity_type=l.entity_type,
            entity_id=l.entity_id,
            details=l.details,
            ip_address=l.ip_address,
            created_at=l.created_at,
            user_name=l.user.full_name if l.user else None,
            user_email=l.user.email if l.user else None,
        ))
    return results
