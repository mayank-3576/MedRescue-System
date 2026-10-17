"""Persist the transfer priority selected by the requesting hospital.

Revision ID: 0002_transfer_urgency
Revises: 0001_medrescue_initial_schema
"""
from alembic import op
from sqlalchemy import Column, String, inspect, text

revision = "0002_transfer_urgency"
down_revision = "0001_medrescue_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("transfer_requests")}
    if "urgency" not in columns:
        op.add_column("transfer_requests", Column("urgency", String(20), nullable=False, server_default=text("'routine'")))


def downgrade() -> None:
    if "urgency" in {column["name"] for column in inspect(op.get_bind()).get_columns("transfer_requests")}:
        op.drop_column("transfer_requests", "urgency")
