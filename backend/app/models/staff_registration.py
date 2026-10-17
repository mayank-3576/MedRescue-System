from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class StaffRegistrationRequest(Base):
    __tablename__ = "staff_registration_requests"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(160), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    government_id_type = Column(String(32), nullable=False)
    government_id_document_path = Column(Text, nullable=True)
    government_id_document_mime = Column(String(80), nullable=True)
    authorization_document_path = Column(Text, nullable=True)
    authorization_document_mime = Column(String(80), nullable=True)
    government_id_document_viewed = Column(Boolean, nullable=False, default=False)
    authorization_document_viewed = Column(Boolean, nullable=False, default=False)
    status = Column(String(16), nullable=False, default="pending", index=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(String(500), nullable=True)
    government_id_verified = Column(Boolean, nullable=False, default=False)
    hospital_authorization_verified = Column(Boolean, nullable=False, default=False)

    hospital = relationship("Hospital")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
