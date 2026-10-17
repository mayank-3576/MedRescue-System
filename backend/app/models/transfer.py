from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id = Column(Integer, primary_key=True, index=True)
    source_hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("medicine_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_quantity = Column(Integer, nullable=False)
    urgency = Column(String(20), nullable=False, default="routine")
    approved_quantity = Column(Integer, nullable=False, default=0)
    dispatched_quantity = Column(Integer, nullable=False, default=0)
    received_quantity = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="draft", index=True)
    # Statuses: draft, pending_approval, approved, rejected, dispatched, received, cancelled
    route_distance_km = Column(Float, nullable=True)
    delivery_cost = Column(Float, nullable=True)
    is_road_distance = Column(Boolean, default=False, nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    source_hospital = relationship("Hospital", foreign_keys=[source_hospital_id], back_populates="outbound_transfers")
    destination_hospital = relationship("Hospital", foreign_keys=[destination_hospital_id], back_populates="inbound_transfers")
    batch = relationship("MedicineBatch", back_populates="transfers")
    medicine = relationship("Medicine", back_populates="transfers")
    requester = relationship("User", foreign_keys=[requested_by], back_populates="requested_transfers")
    approver = relationship("User", foreign_keys=[approved_by], back_populates="approved_transfers")
    delivery_estimates = relationship("DeliveryEstimate", back_populates="transfer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_transfer_status", "status"),
        Index("idx_transfer_source_dest", "source_hospital_id", "destination_hospital_id"),
    )
