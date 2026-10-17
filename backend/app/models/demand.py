from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, Date as SQLDate, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class DemandRecord(Base):
    __tablename__ = "demand_records"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    required_quantity = Column(Integer, nullable=False)
    original_quantity = Column(Integer, nullable=False, default=0)
    priority = Column(String(50), nullable=False, default="medium", index=True)  # critical, high, medium, low
    notes = Column(Text, nullable=True)
    demand_date = Column(SQLDate, nullable=False, default=date.today, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    hospital = relationship("Hospital", back_populates="demands")
    medicine = relationship("Medicine", back_populates="demands")

    __table_args__ = (
        Index("idx_demand_hospital_active", "hospital_id", "is_active"),
        Index("idx_demand_medicine_active", "medicine_id", "is_active"),
    )
