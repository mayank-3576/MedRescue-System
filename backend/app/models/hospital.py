from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=True)
    pmjay_hospital_id = Column(String(100), unique=True, index=True, nullable=True)
    pmjay_verification_status = Column(String(30), nullable=False, default="unverified")
    pmjay_verified_at = Column(DateTime, nullable=True)
    pmjay_verified_by = Column(Integer, nullable=True)
    address = Column(String(500), nullable=False)
    city = Column(String(100), index=True, nullable=False)
    state = Column(String(100), index=True, nullable=False)
    pincode = Column(String(20), nullable=True)
    bed_capacity = Column(Integer, default=0, nullable=False)
    hospital_type = Column(String(50), default="government", nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="hospital")
    batches = relationship("MedicineBatch", back_populates="hospital", cascade="all, delete-orphan")
    alerts = relationship("ExpiryAlert", back_populates="hospital", cascade="all, delete-orphan")
    demands = relationship("DemandRecord", back_populates="hospital", cascade="all, delete-orphan")
    outbound_transfers = relationship("TransferRequest", foreign_keys="TransferRequest.source_hospital_id", back_populates="source_hospital")
    inbound_transfers = relationship("TransferRequest", foreign_keys="TransferRequest.destination_hospital_id", back_populates="destination_hospital")
    source_estimates = relationship("DeliveryEstimate", foreign_keys="DeliveryEstimate.source_hospital_id", back_populates="source_hospital")
    dest_estimates = relationship("DeliveryEstimate", foreign_keys="DeliveryEstimate.destination_hospital_id", back_populates="destination_hospital")
