from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class MedicineOrder(Base):
    __tablename__ = "medicine_orders"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(36), unique=True, nullable=False, index=True)
    buyer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    buyer_hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True)
    buyer_name = Column(String(160), nullable=False)
    buyer_email = Column(String(255), nullable=True)
    buyer_phone = Column(String(32), nullable=False)
    delivery_address = Column(Text, nullable=False)
    payment_method = Column(String(20), nullable=False, default="razorpay")
    buyer_payment_reference = Column(String(64), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(24), nullable=False, default="pending", index=True)
    gateway_order_id = Column(String(100), unique=True, nullable=True, index=True)
    gateway_payment_id = Column(String(100), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    paid_at = Column(DateTime, nullable=True)

    items = relationship("MedicineOrderItem", back_populates="order", cascade="all, delete-orphan")


class MedicineOrderItem(Base):
    __tablename__ = "medicine_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("medicine_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(Integer, ForeignKey("medicine_batches.id", ondelete="SET NULL"), nullable=True)
    medicine_name = Column(String(255), nullable=False)
    batch_number = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)

    order = relationship("MedicineOrder", back_populates="items")


class WithdrawalAccount(Base):
    __tablename__ = "withdrawal_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_type = Column(String(12), nullable=False)
    holder_name = Column(String(160), nullable=False)
    upi_id = Column(String(120), nullable=True)
    bank_name = Column(String(160), nullable=True)
    account_number = Column(String(40), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WithdrawalRequest(Base):
    __tablename__ = "withdrawal_requests"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(36), unique=True, nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("withdrawal_accounts.id", ondelete="SET NULL"), nullable=True)
    account_snapshot = Column(JSON, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    platform_fee = Column(Numeric(12, 2), nullable=False)
    net_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(24), nullable=False, default="pending", index=True)
    payout_reference = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
