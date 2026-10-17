"""Add PM-JAY identity and activation gate for new facilities.

Revision ID: 0006_pmjay_hospital_verification
Revises: 0005_demand_observation_history
"""
from alembic import op
from sqlalchemy import Column, DateTime, Integer, String, inspect, text

revision = "0006_pmjay_hospital_verification"
down_revision = "0005_demand_observation_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("hospitals")}
    if "pmjay_hospital_id" not in columns:
        op.add_column("hospitals", Column("pmjay_hospital_id", String(100), nullable=True))
        op.create_index("ix_hospitals_pmjay_hospital_id", "hospitals", ["pmjay_hospital_id"], unique=True)
    if "pmjay_verification_status" not in columns:
        op.add_column("hospitals", Column("pmjay_verification_status", String(30), nullable=False, server_default=text("'unverified'")))
    if "pmjay_verified_at" not in columns:
        op.add_column("hospitals", Column("pmjay_verified_at", DateTime, nullable=True))
    if "pmjay_verified_by" not in columns:
        op.add_column("hospitals", Column("pmjay_verified_by", Integer, nullable=True))


def downgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("hospitals")}
    for column in ("pmjay_verified_by", "pmjay_verified_at", "pmjay_verification_status", "pmjay_hospital_id"):
        if column in columns:
            op.drop_column("hospitals", column)
