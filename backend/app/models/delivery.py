from datetime import datetime
from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class DeliveryEstimate(Base):
    __tablename__ = "delivery_estimates"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfer_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    source_hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    distance_km = Column(Float, nullable=False)
    is_road_distance = Column(Boolean, default=False, nullable=False)
    cost_per_km = Column(Float, nullable=False)
    fixed_charge = Column(Float, nullable=False)
    estimated_cost = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    transfer = relationship("TransferRequest", back_populates="delivery_estimates")
    source_hospital = relationship("Hospital", foreign_keys=[source_hospital_id], back_populates="source_estimates")
    destination_hospital = relationship("Hospital", foreign_keys=[destination_hospital_id], back_populates="dest_estimates")
