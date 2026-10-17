"""Add inventory movement ledger.

Revision ID: 0003_inventory_movements
Revises: 0002_transfer_urgency
"""
from alembic import op
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, inspect

revision = "0003_inventory_movements"
down_revision = "0002_transfer_urgency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "inventory_movements" in inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "inventory_movements",
        Column("id", Integer, primary_key=True),
        Column("hospital_id", Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False),
        Column("medicine_id", Integer, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False),
        Column("batch_id", Integer, ForeignKey("medicine_batches.id", ondelete="SET NULL"), nullable=True),
        Column("user_id", Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        Column("movement_type", String(40), nullable=False),
        Column("quantity_change", Integer, nullable=False),
        Column("reference", String(100)),
        Column("notes", String(500)),
        Column("created_at", DateTime, nullable=False),
    )
    for name, column in [("ix_inventory_movements_hospital_id", "hospital_id"), ("ix_inventory_movements_medicine_id", "medicine_id"), ("ix_inventory_movements_batch_id", "batch_id"), ("ix_inventory_movements_created_at", "created_at")]:
        op.create_index(name, "inventory_movements", [column])
    op.create_index("idx_inventory_movement_hospital_time", "inventory_movements", ["hospital_id", "created_at"])


def downgrade() -> None:
    if "inventory_movements" in inspect(op.get_bind()).get_table_names():
        op.drop_table("inventory_movements")
