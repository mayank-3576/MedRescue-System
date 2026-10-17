from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ShopProduct(BaseModel):
    id: int
    name: str
    generic_name: str
    category: str
    dosage_form: str
    strength: str
    manufacturer: str
    unit_price: Decimal
    available_quantity: int


class OrderLineInput(BaseModel):
    medicine_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=20)


class OrderCreate(BaseModel):
    buyer_phone: str = Field(min_length=10, max_length=16)
    items: list[OrderLineInput] = Field(min_length=1, max_length=20)

    @field_validator("buyer_phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized = "".join(char for char in value if char.isdigit())
        if len(normalized) not in (10, 12) or (len(normalized) == 12 and not normalized.startswith("91")):
            raise ValueError("Enter a valid 10-digit Indian phone number")
        return normalized[-10:]

    @model_validator(mode="after")
    def unique_medicine_lines(self):
        ids = [line.medicine_id for line in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each medicine can appear only once in an order")
        return self


class OrderCreated(BaseModel):
    order_id: str
    gateway_order_id: str
    amount: Decimal
    currency: str = "INR"
    key_id: str
    buyer_name: str
    buyer_email: Optional[str] = None
    buyer_phone: str


class ManualUpiOrderCreated(BaseModel):
    order_id: str
    amount: Decimal
    upi_id: str
    payee_name: str
    payment_note: str


class UpiReferenceSubmit(BaseModel):
    payment_reference: str = Field(min_length=8, max_length=64)

    @field_validator("payment_reference")
    @classmethod
    def clean_payment_reference(cls, value: str) -> str:
        cleaned = "".join(value.split()).upper()
        if not cleaned.isalnum() or len(cleaned) < 8:
            raise ValueError("Enter the UPI transaction reference (UTR) shown by your payment app")
        return cleaned


class ManualPaymentDecision(BaseModel):
    status: Literal["paid", "rejected"]


class CollectionUpiSettings(BaseModel):
    upi_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("upi_id")
    @classmethod
    def validate_upi_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        cleaned = value.strip()
        if "@" not in cleaned or len(cleaned) < 5 or any(char.isspace() for char in cleaned):
            raise ValueError("Enter a valid UPI ID, for example name@bank")
        return cleaned


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class CustomerOrderStatus(BaseModel):
    order_id: str
    status: str
    amount: Decimal
    created_at: datetime
    paid_at: Optional[datetime] = None


class WithdrawalAccountCreate(BaseModel):
    account_type: Literal["upi", "bank"]
    holder_name: str = Field(min_length=2, max_length=160)
    upi_id: Optional[str] = Field(default=None, max_length=120)
    bank_name: Optional[str] = Field(default=None, max_length=160)
    account_number: Optional[str] = Field(default=None, min_length=6, max_length=40)
    ifsc_code: Optional[str] = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_destination(self):
        if self.account_type == "upi":
            if not self.upi_id or "@" not in self.upi_id or any((self.bank_name, self.account_number, self.ifsc_code)):
                raise ValueError("Enter a valid UPI ID only for a UPI account")
        elif not all((self.bank_name, self.account_number, self.ifsc_code)) or self.upi_id:
            raise ValueError("Bank name, account number and IFSC are required for a bank account")
        return self


class WithdrawalAccountResponse(BaseModel):
    id: int
    account_type: str
    holder_name: str
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WithdrawalCreate(BaseModel):
    account_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class WithdrawalStatusUpdate(BaseModel):
    status: Literal["paid", "rejected"]
    payout_reference: Optional[str] = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def require_reference_when_paid(self):
        if self.status == "paid" and not (self.payout_reference or "").strip():
            raise ValueError("A UPI/bank transfer reference is required when marking a withdrawal paid")
        return self


class WithdrawalResponse(BaseModel):
    id: int
    public_id: str
    account_id: Optional[int]
    account_snapshot: dict
    amount: Decimal
    platform_fee: Decimal
    net_amount: Decimal
    status: str
    payout_reference: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaidOrderAdminResponse(BaseModel):
    public_id: str
    buyer_user_id: Optional[int]
    buyer_hospital_id: Optional[int]
    buyer_hospital_name: Optional[str]
    buyer_name: str
    buyer_email: Optional[str]
    buyer_phone: str
    delivery_address: str
    payment_method: str
    buyer_payment_reference: Optional[str]
    amount: Decimal
    status: str
    gateway_payment_id: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]
    items: list[dict]


class WalletSummary(BaseModel):
    gross_collected: Decimal
    available_balance: Decimal
    reserved_withdrawals: Decimal
    paid_withdrawals: Decimal
    platform_fees_collected: Decimal
    platform_fee_percent: Decimal
    payment_enabled: bool
