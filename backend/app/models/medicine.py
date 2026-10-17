from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    generic_name = Column(String(255), index=True, nullable=False)
    dosage_form = Column(String(100), nullable=False)  # Tablet, Capsule, Injection, Syrup, Ointment, etc.
    strength = Column(String(100), nullable=False)     # e.g., 500mg, 10ml, 5mg/ml
    manufacturer = Column(String(255), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False)  # Antibiotic, Analgesic, Antidiabetic, etc.
    barcode = Column(String(100), unique=True, index=True, nullable=True)
    unit_price = Column(Float, default=0.0, nullable=False)
    min_stock_level = Column(Integer, default=0, nullable=False)
    requires_cold_chain = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    batches = relationship("MedicineBatch", back_populates="medicine", cascade="all, delete-orphan")
    alerts = relationship("ExpiryAlert", back_populates="medicine", cascade="all, delete-orphan")
    demands = relationship("DemandRecord", back_populates="medicine", cascade="all, delete-orphan")
    transfers = relationship("TransferRequest", back_populates="medicine")
