from typing import Optional
from fastapi import Depends, HTTPException, status
from app.models.user import User
from app.auth.security import get_current_active_user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency that ensures the authenticated user is an administrator."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


def require_staff_or_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency that ensures the user is either staff or administrator."""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized hospital staff or admin privileges required"
        )
    return current_user


def verify_hospital_access(hospital_id: int, current_user: User) -> None:
    """Verify that the user has permission to view or manipulate data for a given hospital."""
    if current_user.role == "admin":
        return
    if current_user.role == "staff":
        if current_user.hospital_id is None or current_user.hospital_id != hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are only authorized to access hospital {current_user.hospital_id}"
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Unauthorized access"
    )
