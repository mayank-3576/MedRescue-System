import hashlib
import hmac
import json
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.auth.security import get_current_active_user
from app.config import settings
from app.database import get_db
from app.models.batch import MedicineBatch
from app.models.medicine import Medicine
from app.models.hospital import Hospital
from app.models.payment import MedicineOrder, MedicineOrderItem, WithdrawalAccount, WithdrawalRequest
from app.models.setting import ApplicationSetting
from app.models.user import User
from app.schemas.payment import (
    CustomerOrderStatus,
    CollectionUpiSettings,
    ManualPaymentDecision,
    ManualUpiOrderCreated,
    OrderCreate,
    OrderCreated,
    PaidOrderAdminResponse,
    PaymentVerify,
    ShopProduct,
    WalletSummary,
    WithdrawalAccountCreate,
    WithdrawalAccountResponse,
    WithdrawalCreate,
    WithdrawalResponse,
    WithdrawalStatusUpdate,
    UpiReferenceSubmit,
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api", tags=["Medicine payments and platform wallet"])
MONEY = Decimal("0.01")
DEFAULT_PLATFORM_FEE_PERCENT = Decimal("2.00")


def require_medicine_buyer(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> User:
    """Only active staff assigned to an active hospital can buy its stock."""
    if current_user.role != "staff" or current_user.hospital_id is None:
        raise HTTPException(status_code=403, detail="Medicine purchases are available to authorized hospital staff only")
    hospital = db.query(Hospital).filter(
        Hospital.id == current_user.hospital_id,
        Hospital.is_active.is_(True),
    ).first()
    if not hospital:
        raise HTTPException(status_code=403, detail="Your hospital is inactive or not assigned. Contact an administrator.")
    return current_user


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _payment_is_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _buyer_collection_upi(db: Session) -> str | None:
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "buyer_collection_upi_id").first()
    return setting.value.strip() if setting and setting.value.strip() else None


def _make_gateway_order(amount: Decimal, receipt: str) -> str:
    try:
        response = httpx.post(
            "https://api.razorpay.com/v1/orders",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={"amount": int(amount * 100), "currency": "INR", "receipt": receipt},
            timeout=15,
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("id"):
            raise ValueError("Razorpay did not return an order ID")
        return result["id"]
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Payment provider could not create the order. Please retry.") from exc


def _get_gateway_payment(payment_id: str) -> dict:
    try:
        response = httpx.get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not verify payment with the payment provider.") from exc


def _release_order_reservations(db: Session, order: MedicineOrder) -> None:
    for item in order.items:
        if item.batch_id is None:
            continue
        batch = db.query(MedicineBatch).filter(MedicineBatch.id == item.batch_id).with_for_update().first()
        if batch:
            batch.reserved_quantity = max(0, batch.reserved_quantity - item.quantity)


def _expire_old_orders(db: Session) -> None:
    """Release abandoned checkout reservations after 30 minutes."""
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    old_orders = db.query(MedicineOrder).filter(
        MedicineOrder.status.in_(["pending", "awaiting_payment"]), MedicineOrder.created_at < cutoff
    ).all()
    for order in old_orders:
        _release_order_reservations(db, order)
        order.status = "expired"
    if old_orders:
        db.commit()


def _mark_order_paid(db: Session, order: MedicineOrder, payment_id: str) -> None:
    if order.status == "paid":
        return
    if order.status == "expired":
        # A very late capture must never be added to the spendable wallet without inventory.
        order.status = "refund_required"
        order.gateway_payment_id = payment_id
        order.paid_at = datetime.utcnow()
        db.commit()
        return
    if order.status not in ("pending", "payment_submitted"):
        raise HTTPException(status_code=409, detail="This checkout is no longer active")

    # Confirm the held stock still exists before converting reservations into sales.
    for item in order.items:
        if item.batch_id is None:
            order.status = "refund_required"
            order.gateway_payment_id = payment_id
            order.paid_at = datetime.utcnow()
            db.commit()
            return
        batch = db.query(MedicineBatch).filter(MedicineBatch.id == item.batch_id).with_for_update().first()
        if not batch or batch.reserved_quantity < item.quantity or batch.available_quantity < item.quantity:
            order.status = "refund_required"
            order.gateway_payment_id = payment_id
            order.paid_at = datetime.utcnow()
            db.commit()
            return

    for item in order.items:
        batch = db.query(MedicineBatch).filter(MedicineBatch.id == item.batch_id).with_for_update().first()
        batch.reserved_quantity -= item.quantity
        batch.available_quantity -= item.quantity

    order.gateway_payment_id = payment_id if order.payment_method == "razorpay" else None
    order.status = "paid"
    order.paid_at = datetime.utcnow()
    db.commit()


def _account_snapshot(account: WithdrawalAccount) -> dict:
    if account.account_type == "upi":
        return {"account_type": "upi", "holder_name": account.holder_name, "upi_id": account.upi_id}
    return {
        "account_type": "bank",
        "holder_name": account.holder_name,
        "bank_name": account.bank_name,
        "account_number": account.account_number,
        "ifsc_code": account.ifsc_code,
    }


def _platform_fee_percent(db: Session) -> Decimal:
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "platform_fee_percent").first()
    if not setting:
        setting = ApplicationSetting(
            key="platform_fee_percent",
            value=str(DEFAULT_PLATFORM_FEE_PERCENT),
            description="Percentage charged on platform wallet withdrawals",
            category="payments",
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    try:
        fee = Decimal(setting.value)
    except Exception:
        fee = DEFAULT_PLATFORM_FEE_PERCENT
    return min(max(fee, Decimal("0")), Decimal("100"))


def _wallet_totals(db: Session) -> tuple[Decimal, Decimal, Decimal, Decimal, Decimal]:
    gross = _money(db.query(func.coalesce(func.sum(MedicineOrder.amount), 0)).filter(MedicineOrder.status == "paid").scalar())
    reserved = _money(db.query(func.coalesce(func.sum(WithdrawalRequest.amount), 0)).filter(WithdrawalRequest.status.in_(["pending", "processing"])).scalar())
    paid = _money(db.query(func.coalesce(func.sum(WithdrawalRequest.amount), 0)).filter(WithdrawalRequest.status == "paid").scalar())
    fees = _money(db.query(func.coalesce(func.sum(WithdrawalRequest.platform_fee), 0)).filter(WithdrawalRequest.status == "paid").scalar())
    return gross, max(Decimal("0"), gross - reserved - paid), reserved, paid, fees


def _reserve_medicine_order(db: Session, buyer: User, data: OrderCreate, payment_method: str) -> tuple[MedicineOrder, Decimal]:
    hospital = db.query(Hospital).filter(Hospital.id == buyer.hospital_id, Hospital.is_active.is_(True)).first()
    if not hospital:
        raise HTTPException(status_code=403, detail="Your assigned hospital is inactive")
    order = MedicineOrder(
        public_id=str(uuid.uuid4()),
        buyer_user_id=buyer.id,
        buyer_hospital_id=hospital.id,
        buyer_name=buyer.full_name,
        buyer_email=buyer.email,
        buyer_phone=data.buyer_phone,
        delivery_address=f"{hospital.name}, {hospital.address}, {hospital.city}, {hospital.state} {hospital.pincode or ''}".strip(),
        payment_method=payment_method,
        amount=Decimal("0.00"),
        status="awaiting_payment" if payment_method == "upi_manual" else "pending",
    )
    db.add(order)
    db.flush()

    total = Decimal("0.00")
    for line in data.items:
        medicine = db.query(Medicine).filter(Medicine.id == line.medicine_id).first()
        if not medicine:
            raise HTTPException(status_code=404, detail=f"Medicine {line.medicine_id} was not found")
        unit_price = _money(medicine.unit_price)
        if unit_price <= 0:
            raise HTTPException(status_code=409, detail=f"{medicine.name} is not currently available for purchase")
        batches = db.query(MedicineBatch).filter(
            MedicineBatch.medicine_id == medicine.id,
            MedicineBatch.status == "active",
            MedicineBatch.expiry_date >= date.today(),
            MedicineBatch.hospital_id == buyer.hospital_id,
        ).order_by(MedicineBatch.expiry_date.asc()).with_for_update().all()
        needed = line.quantity
        for batch in batches:
            available = max(0, batch.available_quantity - batch.reserved_quantity)
            take = min(needed, available)
            if take <= 0:
                continue
            batch.reserved_quantity += take
            db.add(MedicineOrderItem(
                order_id=order.id,
                medicine_id=medicine.id,
                batch_id=batch.id,
                medicine_name=medicine.name,
                batch_number=batch.batch_number,
                quantity=take,
                unit_price=unit_price,
            ))
            needed -= take
            if needed == 0:
                break
        if needed:
            raise HTTPException(status_code=409, detail=f"Only {line.quantity - needed} units of {medicine.name} are available")
        total += unit_price * line.quantity
    order.amount = total.quantize(MONEY)
    return order, order.amount


@router.get("/shop/medicines", response_model=list[ShopProduct])
def list_shop_medicines(
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    _expire_old_orders(db)
    today = date.today()
    medicines = db.query(Medicine).order_by(Medicine.name.asc()).all()
    products = []
    for medicine in medicines:
        batches = db.query(MedicineBatch).filter(
            MedicineBatch.medicine_id == medicine.id,
            MedicineBatch.status == "active",
            MedicineBatch.expiry_date >= today,
            MedicineBatch.hospital_id == buyer.hospital_id,
        ).all()
        available = sum(max(0, batch.available_quantity - batch.reserved_quantity) for batch in batches)
        if available > 0 and _money(medicine.unit_price) > 0:
            products.append(ShopProduct(
                id=medicine.id,
                name=medicine.name,
                generic_name=medicine.generic_name,
                category=medicine.category,
                dosage_form=medicine.dosage_form,
                strength=medicine.strength,
                manufacturer=medicine.manufacturer,
                unit_price=_money(medicine.unit_price),
                available_quantity=available,
            ))
    return products


@router.get("/shop/payment-config")
def payment_config(
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    collection_upi = _buyer_collection_upi(db)
    return {
        "enabled": _payment_is_configured(),
        "provider": "Razorpay",
        "currency": "INR",
        "upi_enabled": bool(collection_upi),
        "upi_id": collection_upi,
    }


@router.post("/shop/orders", response_model=OrderCreated, status_code=status.HTTP_201_CREATED)
def create_shop_order(
    data: OrderCreate,
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    if not _payment_is_configured():
        raise HTTPException(status_code=503, detail="Online payments are not configured. Add Razorpay keys to backend/.env.")
    _expire_old_orders(db)
    try:
        order, _ = _reserve_medicine_order(db, buyer, data, "razorpay")
        gateway_order_id = _make_gateway_order(order.amount, order.public_id)
        order.gateway_order_id = gateway_order_id
        db.commit()
        return OrderCreated(
            order_id=order.public_id,
            gateway_order_id=gateway_order_id,
            amount=order.amount,
            key_id=settings.RAZORPAY_KEY_ID,
            buyer_name=order.buyer_name,
            buyer_email=order.buyer_email,
            buyer_phone=order.buyer_phone,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/shop/upi-orders", response_model=ManualUpiOrderCreated, status_code=status.HTTP_201_CREATED)
def create_manual_upi_order(
    data: OrderCreate,
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    upi_id = _buyer_collection_upi(db)
    if not upi_id:
        raise HTTPException(status_code=503, detail="The admin has not configured a UPI collection ID yet")
    _expire_old_orders(db)
    try:
        order, _ = _reserve_medicine_order(db, buyer, data, "upi_manual")
        db.commit()
        return ManualUpiOrderCreated(
            order_id=order.public_id,
            amount=order.amount,
            upi_id=upi_id,
            payee_name="MedRescue Pharmacy",
            payment_note=f"MR-{order.public_id[:12]}",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/shop/orders/{order_id}/upi-reference", response_model=CustomerOrderStatus)
def submit_upi_reference(
    order_id: str,
    data: UpiReferenceSubmit,
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    _expire_old_orders(db)
    order = db.query(MedicineOrder).filter(MedicineOrder.public_id == order_id).with_for_update().first()
    if not order or order.buyer_user_id != buyer.id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_method != "upi_manual" or order.status != "awaiting_payment":
        raise HTTPException(status_code=409, detail="This order is not waiting for UPI payment details")
    duplicate_reference = db.query(MedicineOrder.id).filter(
        MedicineOrder.buyer_payment_reference == data.payment_reference,
        MedicineOrder.id != order.id,
    ).first()
    if duplicate_reference:
        raise HTTPException(status_code=409, detail="This UPI transaction reference was already submitted")
    order.buyer_payment_reference = data.payment_reference
    order.status = "payment_submitted"
    db.commit()
    db.refresh(order)
    return CustomerOrderStatus(order_id=order.public_id, status=order.status, amount=order.amount, created_at=order.created_at, paid_at=order.paid_at)


@router.post("/shop/orders/{order_id}/verify", response_model=CustomerOrderStatus)
def verify_shop_payment(
    order_id: str,
    data: PaymentVerify,
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    order = db.query(MedicineOrder).filter(MedicineOrder.public_id == order_id).first()
    if not order or not order.gateway_order_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_user_id != buyer.id:
        raise HTTPException(status_code=403, detail="This order belongs to another authorized staff account")
    if data.razorpay_order_id != order.gateway_order_id:
        raise HTTPException(status_code=400, detail="Payment order does not match")
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{data.razorpay_order_id}|{data.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature is invalid")
    payment = _get_gateway_payment(data.razorpay_payment_id)
    if (
        payment.get("order_id") != order.gateway_order_id
        or payment.get("amount") != int(order.amount * 100)
        or payment.get("currency") != "INR"
    ):
        raise HTTPException(status_code=400, detail="Payment details do not match this order")
    if payment.get("status") != "captured":
        raise HTTPException(status_code=409, detail="Payment has not been captured yet")
    _mark_order_paid(db, order, data.razorpay_payment_id)
    return CustomerOrderStatus(order_id=order.public_id, status=order.status, amount=order.amount, created_at=order.created_at, paid_at=order.paid_at)


@router.post("/shop/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str | None = Header(default=None), db: Session = Depends(get_db)):
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not configured")
    raw_body = await request.body()
    expected = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    if not x_razorpay_signature or not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc
    if payload.get("event") == "payment.captured":
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        gateway_order_id = entity.get("order_id")
        order = db.query(MedicineOrder).filter(MedicineOrder.gateway_order_id == gateway_order_id).first()
        if order and entity.get("amount") == int(order.amount * 100) and entity.get("currency") == "INR":
            _mark_order_paid(db, order, entity["id"])
    return {"received": True}


@router.get("/shop/orders/{order_id}", response_model=CustomerOrderStatus)
def get_shop_order_status(
    order_id: str,
    buyer: User = Depends(require_medicine_buyer),
    db: Session = Depends(get_db),
):
    order = db.query(MedicineOrder).filter(MedicineOrder.public_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_user_id != buyer.id:
        raise HTTPException(status_code=403, detail="This order belongs to another authorized staff account")
    return CustomerOrderStatus(order_id=order.public_id, status=order.status, amount=order.amount, created_at=order.created_at, paid_at=order.paid_at)


@router.get("/wallet/summary", response_model=WalletSummary)
def wallet_summary(admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    _expire_old_orders(db)
    gross, available, reserved, paid, fees = _wallet_totals(db)
    return WalletSummary(
        gross_collected=gross,
        available_balance=available,
        reserved_withdrawals=reserved,
        paid_withdrawals=paid,
        platform_fees_collected=fees,
        platform_fee_percent=_platform_fee_percent(db),
        payment_enabled=_payment_is_configured(),
    )


@router.put("/wallet/platform-fee")
def update_platform_fee(value: Decimal, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    if value < 0 or value > 100:
        raise HTTPException(status_code=422, detail="Platform fee must be between 0 and 100 percent")
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "platform_fee_percent").first()
    if not setting:
        setting = ApplicationSetting(key="platform_fee_percent", category="payments", description="Percentage charged on platform wallet withdrawals")
    setting.value = str(value.quantize(Decimal("0.01")))
    setting.updated_by = admin_user.id
    db.add(setting)
    db.commit()
    log_audit_event(db, "UPDATE_PLATFORM_FEE", "setting", setting.id, admin_user.id, {"percent": setting.value})
    return {"platform_fee_percent": Decimal(setting.value)}


@router.get("/wallet/payment-settings")
def get_payment_settings(admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {"buyer_collection_upi_id": _buyer_collection_upi(db)}


@router.put("/wallet/payment-settings")
def update_payment_settings(
    data: CollectionUpiSettings,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "buyer_collection_upi_id").first()
    if not setting:
        setting = ApplicationSetting(
            key="buyer_collection_upi_id",
            category="payments",
            description="UPI ID used by authorized hospital staff to pay for medicine orders",
            value="",
        )
    setting.value = data.upi_id or ""
    setting.category = "payments"
    setting.description = "UPI ID used by authorized hospital staff to pay for medicine orders"
    setting.updated_by = admin_user.id
    db.add(setting)
    db.commit()
    db.refresh(setting)
    log_audit_event(db, "UPDATE_BUYER_COLLECTION_UPI", "setting", setting.id, admin_user.id, {"configured": bool(setting.value)})
    return {"buyer_collection_upi_id": setting.value or None}


@router.get("/wallet/accounts", response_model=list[WithdrawalAccountResponse])
def list_withdrawal_accounts(admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(WithdrawalAccount).order_by(WithdrawalAccount.created_at.desc()).all()


@router.post("/wallet/accounts", response_model=WithdrawalAccountResponse, status_code=status.HTTP_201_CREATED)
def add_withdrawal_account(data: WithdrawalAccountCreate, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    account = WithdrawalAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    log_audit_event(db, "ADD_WITHDRAWAL_ACCOUNT", "withdrawal_account", account.id, admin_user.id, {"type": account.account_type, "holder_name": account.holder_name})
    return account


@router.delete("/wallet/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_withdrawal_account(account_id: int, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    account = db.query(WithdrawalAccount).filter(WithdrawalAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Withdrawal account not found")
    db.delete(account)
    db.commit()
    log_audit_event(db, "DELETE_WITHDRAWAL_ACCOUNT", "withdrawal_account", account_id, admin_user.id)
    return None


@router.post("/wallet/withdrawals", response_model=WithdrawalResponse, status_code=status.HTTP_201_CREATED)
def request_withdrawal(data: WithdrawalCreate, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    account = db.query(WithdrawalAccount).filter(WithdrawalAccount.id == data.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Withdrawal account not found")
    amount = _money(data.amount)
    _, available, _, _, _ = _wallet_totals(db)
    if amount <= 0 or amount > available:
        raise HTTPException(status_code=409, detail=f"Withdrawal exceeds available balance of ₹{available}")
    fee_percent = _platform_fee_percent(db)
    fee = (amount * fee_percent / Decimal("100")).quantize(MONEY, rounding=ROUND_HALF_UP)
    withdrawal = WithdrawalRequest(
        public_id=str(uuid.uuid4()),
        account_id=account.id,
        account_snapshot=_account_snapshot(account),
        amount=amount,
        platform_fee=fee,
        net_amount=amount - fee,
        status="pending",
    )
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)
    log_audit_event(db, "REQUEST_WITHDRAWAL", "withdrawal", withdrawal.id, admin_user.id, {"amount": str(amount), "fee": str(fee), "net_amount": str(withdrawal.net_amount)})
    return withdrawal


@router.get("/wallet/withdrawals", response_model=list[WithdrawalResponse])
def list_withdrawals(admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc()).limit(100).all()


@router.post("/wallet/withdrawals/{withdrawal_id}/status", response_model=WithdrawalResponse)
def update_withdrawal_status(withdrawal_id: int, data: WithdrawalStatusUpdate, admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    withdrawal = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == withdrawal_id).with_for_update().first()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending withdrawals can be processed")
    withdrawal.status = data.status
    withdrawal.payout_reference = data.payout_reference.strip() if data.payout_reference else None
    withdrawal.processed_by = admin_user.id
    withdrawal.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(withdrawal)
    log_audit_event(db, "PROCESS_WITHDRAWAL", "withdrawal", withdrawal.id, admin_user.id, {"status": withdrawal.status, "payout_reference": withdrawal.payout_reference})
    return withdrawal


@router.get("/wallet/orders", response_model=list[PaidOrderAdminResponse])
def list_wallet_orders(admin_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    orders = db.query(MedicineOrder).order_by(MedicineOrder.created_at.desc()).limit(100).all()
    return [PaidOrderAdminResponse(
        public_id=order.public_id,
        buyer_user_id=order.buyer_user_id,
        buyer_hospital_id=order.buyer_hospital_id,
        buyer_hospital_name=db.query(Hospital.name).filter(Hospital.id == order.buyer_hospital_id).scalar() if order.buyer_hospital_id else None,
        buyer_name=order.buyer_name,
        buyer_email=order.buyer_email,
        buyer_phone=order.buyer_phone,
        delivery_address=order.delivery_address,
        payment_method=order.payment_method,
        buyer_payment_reference=order.buyer_payment_reference,
        amount=order.amount,
        status=order.status,
        gateway_payment_id=order.gateway_payment_id,
        created_at=order.created_at,
        paid_at=order.paid_at,
        items=[{"medicine_name": item.medicine_name, "quantity": item.quantity, "unit_price": item.unit_price, "batch_number": item.batch_number} for item in order.items],
    ) for order in orders]


@router.post("/wallet/orders/{order_id}/upi-payment")
def review_upi_payment(
    order_id: str,
    data: ManualPaymentDecision,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    order = db.query(MedicineOrder).filter(MedicineOrder.public_id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Medicine order not found")
    if order.payment_method != "upi_manual" or order.status != "payment_submitted":
        raise HTTPException(status_code=409, detail="This order has no UPI reference waiting for review")
    if data.status == "paid":
        if not order.buyer_payment_reference:
            raise HTTPException(status_code=409, detail="No UPI transaction reference was submitted")
        _mark_order_paid(db, order, order.buyer_payment_reference)
    else:
        _release_order_reservations(db, order)
        order.status = "payment_rejected"
        db.commit()
    log_audit_event(
        db,
        "REVIEW_MANUAL_UPI_PAYMENT",
        "medicine_order",
        order.id,
        admin_user.id,
        {"status": order.status, "reference": order.buyer_payment_reference},
    )
    return {"order_id": order.public_id, "status": order.status}
