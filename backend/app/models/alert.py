from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class ExpiryAlert(Base):
    __tablename__ = "expiry_alerts"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("medicine_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_level = Column(String(50), nullable=False, index=True)  # critical, high, medium, low, normal, expired
    days_remaining = Column(Integer, nullable=False, index=True)
    alert_status = Column(String(50), nullable=False, default="active", index=True)  # active, acknowledged, resolved
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    batch = relationship("MedicineBatch", back_populates="alerts")
    hospital = relationship("Hospital", back_populates="alerts")
    medicine = relationship("Medicine", back_populates="alerts")

    __table_args__ = (
        Index("idx_alert_hospital_risk", "hospital_id", "risk_level", "alert_status"),
    )
