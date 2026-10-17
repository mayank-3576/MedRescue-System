"""Add verified medicine checkout and admin wallet withdrawal ledger.

Revision ID: 0007_medicine_payments_wallet
Revises: 0006_pmjay_hospital_verification
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_medicine_payments_wallet"
down_revision = "0006_pmjay_hospital_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "medicine_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(36), nullable=False, unique=True),
        sa.Column("buyer_name", sa.String(160), nullable=False),
        sa.Column("buyer_email", sa.String(255), nullable=True),
        sa.Column("buyer_phone", sa.String(32), nullable=False),
        sa.Column("delivery_address", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("gateway_order_id", sa.String(100), nullable=True, unique=True),
        sa.Column("gateway_payment_id", sa.String(100), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_medicine_orders_public_id", "medicine_orders", ["public_id"])
    op.create_index("ix_medicine_orders_status", "medicine_orders", ["status"])
    op.create_index("ix_medicine_orders_gateway_order_id", "medicine_orders", ["gateway_order_id"])
    op.create_index("ix_medicine_orders_gateway_payment_id", "medicine_orders", ["gateway_payment_id"])

    op.create_table(
        "medicine_order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("medicine_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicine_id", sa.Integer(), sa.ForeignKey("medicines.id", ondelete="SET NULL"), nullable=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("medicine_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("medicine_name", sa.String(255), nullable=False),
        sa.Column("batch_number", sa.String(100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
    )
    op.create_index("ix_medicine_order_items_order_id", "medicine_order_items", ["order_id"])

    op.create_table(
        "withdrawal_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_type", sa.String(12), nullable=False),
        sa.Column("holder_name", sa.String(160), nullable=False),
        sa.Column("upi_id", sa.String(120), nullable=True),
        sa.Column("bank_name", sa.String(160), nullable=True),
        sa.Column("account_number", sa.String(40), nullable=True),
        sa.Column("ifsc_code", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(36), nullable=False, unique=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("withdrawal_accounts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_snapshot", sa.JSON(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("payout_reference", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("processed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_withdrawal_requests_public_id", "withdrawal_requests", ["public_id"])
    op.create_index("ix_withdrawal_requests_status", "withdrawal_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_withdrawal_requests_status", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_requests_public_id", table_name="withdrawal_requests")
    op.drop_table("withdrawal_requests")
    op.drop_table("withdrawal_accounts")
    op.drop_index("ix_medicine_order_items_order_id", table_name="medicine_order_items")
    op.drop_table("medicine_order_items")
    op.drop_index("ix_medicine_orders_gateway_payment_id", table_name="medicine_orders")
    op.drop_index("ix_medicine_orders_gateway_order_id", table_name="medicine_orders")
    op.drop_index("ix_medicine_orders_status", table_name="medicine_orders")
    op.drop_index("ix_medicine_orders_public_id", table_name="medicine_orders")
    op.drop_table("medicine_orders")
