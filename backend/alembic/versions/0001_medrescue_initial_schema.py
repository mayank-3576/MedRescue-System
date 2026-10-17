"""Create the MedRescue schema and add catalog fields missing in early demos.

Revision ID: 0001_medrescue_initial_schema
Revises:
"""
from alembic import op
from sqlalchemy import Boolean, Float, Integer, String, inspect, text

from app.models import Base

revision = "0001_medrescue_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    inspector = inspect(bind)

    additions = {
        "hospitals": [
            ("code", String(50)),
            ("pincode", String(20)),
            ("bed_capacity", Integer(), "0"),
            ("hospital_type", String(50), "'government'"),
        ],
        "medicines": [
            ("unit_price", Float(), "0"),
            ("min_stock_level", Integer(), "0"),
            ("requires_cold_chain", Boolean(), "0"),
        ],
    }

    for table_name, columns in additions.items():
        existing = {column["name"] for column in inspect(bind).get_columns(table_name)}
        for definition in columns:
            name, column_type, *default = definition
            if name not in existing:
                server_default = text(default[0]) if default else None
                op.add_column(table_name, __import__("sqlalchemy").Column(
                    name, column_type, nullable=name in {"code", "pincode"}, server_default=server_default
                ))

    hospital_columns = {column["name"] for column in inspect(bind).get_columns("hospitals")}
    if "code" in hospital_columns:
        bind.execute(text("UPDATE hospitals SET code = 'H-' || id WHERE code IS NULL OR code = ''"))


def downgrade() -> None:
    # Preserve local demo records. This baseline migration is intentionally irreversible.
    pass
