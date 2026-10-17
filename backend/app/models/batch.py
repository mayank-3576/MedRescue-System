from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class MedicineBatch(Base):
    __tablename__ = "medicine_batches"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    available_quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    unit_mrp = Column(Float, nullable=False, default=0.0)
    unit_purchase_cost = Column(Float, nullable=False, default=0.0)
    manufacturing_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)
    storage_requirements = Column(String(255), nullable=True, default="Store below 25°C in a dry place")
    status = Column(String(50), nullable=False, default="active", index=True)  # active, expired, recalled, quarantined, damaged
    is_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    medicine = relationship("Medicine", back_populates="batches")
    hospital = relationship("Hospital", back_populates="batches")
    alerts = relationship("ExpiryAlert", back_populates="batch", cascade="all, delete-orphan")
    transfers = relationship("TransferRequest", back_populates="batch")

    __table_args__ = (
        Index("idx_batch_hospital_status", "hospital_id", "status"),
        Index("idx_batch_expiry_status", "expiry_date", "status"),
    )
