"""Create opening movement records for inventory already in the database.

Revision ID: 0004_backfill_opening_stock
Revises: 0003_inventory_movements
"""
from alembic import op
from sqlalchemy import inspect, text

revision = "0004_backfill_opening_stock"
down_revision = "0003_inventory_movements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "inventory_movements" not in inspect(op.get_bind()).get_table_names():
        return
    op.get_bind().execute(text("""
        INSERT INTO inventory_movements
            (hospital_id, medicine_id, batch_id, user_id, movement_type, quantity_change, reference, notes, created_at)
        SELECT b.hospital_id, b.medicine_id, b.id, NULL, 'opening_stock', b.available_quantity,
               'batch:' || b.id, 'Opening balance carried into inventory movement history', CURRENT_TIMESTAMP
        FROM medicine_batches AS b
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movements AS m
            WHERE m.batch_id = b.id AND m.movement_type IN ('opening_stock', 'initial_stock')
        )
    """))


def downgrade() -> None:
    # Keep audit history even when rolling back the migration revision.
    pass
