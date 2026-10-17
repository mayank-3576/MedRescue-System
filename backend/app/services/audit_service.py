from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog


def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    details: Optional[Any] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Record an audit trail event into the audit_logs table."""
    audit_entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        details=details,
        ip_address=ip_address,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()
    return audit_entry
