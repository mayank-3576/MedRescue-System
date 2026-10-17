"""Add staff registration requests with private verification documents.

Revision ID: 0010_staff_registration_review
Revises: 0009_manual_upi_checkout
"""
from alembic import op
import sqlalchemy as sa


revision = "0010_staff_registration_review"
down_revision = "0009_manual_upi_checkout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table("staff_registration_requests"):
        op.create_table(
            "staff_registration_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("full_name", sa.String(length=160), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False),
            sa.Column("government_id_type", sa.String(length=32), nullable=False),
            sa.Column("government_id_document_path", sa.Text(), nullable=True),
            sa.Column("government_id_document_mime", sa.String(length=80), nullable=True),
            sa.Column("authorization_document_path", sa.Text(), nullable=True),
            sa.Column("authorization_document_mime", sa.String(length=80), nullable=True),
            sa.Column("government_id_document_viewed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("authorization_document_viewed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
            sa.Column("submitted_at", sa.DateTime(), nullable=False),
            sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("review_note", sa.String(length=500), nullable=True),
            sa.Column("government_id_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("hospital_authorization_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    existing_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("staff_registration_requests")}
    expected_indexes = {
        "ix_staff_registration_requests_email": ["email"],
        "ix_staff_registration_requests_hospital_id": ["hospital_id"],
        "ix_staff_registration_requests_status": ["status"],
    }
    for name, columns in expected_indexes.items():
        if name not in existing_indexes:
            op.create_index(name, "staff_registration_requests", columns)


def downgrade() -> None:
    op.drop_index("ix_staff_registration_requests_status", table_name="staff_registration_requests")
    op.drop_index("ix_staff_registration_requests_hospital_id", table_name="staff_registration_requests")
    op.drop_index("ix_staff_registration_requests_email", table_name="staff_registration_requests")
    op.drop_table("staff_registration_requests")
