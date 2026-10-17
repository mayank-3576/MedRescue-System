"""Store demand observation dates and original requested quantities for forecasting.

Revision ID: 0005_demand_observation_history
Revises: 0004_backfill_opening_stock
"""
from alembic import op
from sqlalchemy import Column, Date, Integer, inspect, text

revision = "0005_demand_observation_history"
down_revision = "0004_backfill_opening_stock"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("demand_records")}
    if "demand_date" not in columns:
        op.add_column("demand_records", Column("demand_date", Date, nullable=True))
        op.get_bind().execute(text("UPDATE demand_records SET demand_date = DATE(created_at) WHERE demand_date IS NULL"))
        with op.batch_alter_table("demand_records") as batch_op:
            batch_op.alter_column("demand_date", nullable=False)
        op.create_index("ix_demand_records_demand_date", "demand_records", ["demand_date"])
    if "original_quantity" not in columns:
        op.add_column("demand_records", Column("original_quantity", Integer, nullable=True))
        op.get_bind().execute(text("UPDATE demand_records SET original_quantity = required_quantity WHERE original_quantity IS NULL"))
        with op.batch_alter_table("demand_records") as batch_op:
            batch_op.alter_column("original_quantity", nullable=False, server_default="0")


def downgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("demand_records")}
    if "original_quantity" in columns:
        op.drop_column("demand_records", "original_quantity")
    if "demand_date" in columns:
        op.drop_index("ix_demand_records_demand_date", table_name="demand_records")
        op.drop_column("demand_records", "demand_date")
