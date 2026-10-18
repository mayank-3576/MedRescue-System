import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.batches import update_batch
from app.schemas.batch import BatchCreate, BatchUpdate, QuickScanAddRequest
from app.services.barcode_catalog_service import direct_scan_and_add_batch


class BatchDateValidationTests(unittest.TestCase):
    def test_batch_create_rejects_expiry_on_or_before_manufacturing(self):
        common_fields = {
            "medicine_id": 1,
            "hospital_id": 1,
            "batch_number": "LOT-1",
            "available_quantity": 10,
            "unit_mrp": 10,
            "unit_purchase_cost": 5,
            "manufacturing_date": date(2026, 1, 1),
        }

        for expiry_date in (date(2025, 12, 31), date(2026, 1, 1)):
            with self.subTest(expiry_date=expiry_date):
                with self.assertRaises(ValidationError):
                    BatchCreate(**common_fields, expiry_date=expiry_date)

    def test_batch_update_rejects_inconsistent_date_pair(self):
        with self.assertRaises(ValidationError):
            BatchUpdate(
                manufacturing_date=date(2026, 1, 1),
                expiry_date=date(2026, 1, 1),
            )

    def test_partial_batch_update_checks_stored_counterpart_date(self):
        batch = SimpleNamespace(
            id=1,
            hospital_id=1,
            manufacturing_date=date(2026, 1, 1),
            expiry_date=date(2026, 12, 31),
            available_quantity=10,
        )
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = batch

        with patch("app.routers.batches.verify_hospital_access"):
            with self.assertRaises(HTTPException) as context:
                update_batch(
                    batch_id=1,
                    update_data=BatchUpdate(expiry_date=date(2025, 12, 31)),
                    current_user=Mock(),
                    db=db,
                )

        self.assertEqual(context.exception.status_code, 422)
        db.add.assert_not_called()

    def test_quick_scan_rejects_inconsistent_explicit_dates(self):
        with self.assertRaises(ValidationError):
            QuickScanAddRequest(
                barcode="1234567890123",
                manufacturing_date=date(2026, 1, 1),
                expiry_date=date(2025, 12, 31),
            )

    def test_quick_scan_service_rejects_expiry_before_default_manufacturing_date(self):
        db = Mock()
        with self.assertRaisesRegex(ValueError, "Expiry date must be after manufacturing date"):
            direct_scan_and_add_batch(
                db=db,
                barcode="1234567890123",
                hospital_id=1,
                expiry_date=date.today() - timedelta(days=100),
            )

        db.query.assert_not_called()


if __name__ == "__main__":
    unittest.main()