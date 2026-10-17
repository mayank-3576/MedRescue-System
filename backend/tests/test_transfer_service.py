import unittest
from datetime import date, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Hospital, Medicine, MedicineBatch, TransferRequest
from app.services.transfer_service import approve_transfer_request
from fastapi import HTTPException


class TransferApprovalTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        source = Hospital(name="Source", address="A", city="Delhi", state="Delhi", latitude=28.6, longitude=77.2)
        destination = Hospital(name="Destination", address="B", city="Delhi", state="Delhi", latitude=28.7, longitude=77.3)
        medicine = Medicine(name="Test", generic_name="Test", dosage_form="vial", strength="1g", manufacturer="Test", category="antibiotic")
        self.db.add_all([source, destination, medicine])
        self.db.flush()
        self.batch = MedicineBatch(
            medicine_id=medicine.id, hospital_id=source.id, batch_number="LOT-1",
            available_quantity=10, reserved_quantity=0, unit_mrp=10, unit_purchase_cost=5,
            manufacturing_date=date.today() - timedelta(days=30), expiry_date=date.today() + timedelta(days=180),
            status="active",
        )
        self.db.add(self.batch)
        self.db.flush()
        self.transfer = TransferRequest(
            source_hospital_id=source.id, destination_hospital_id=destination.id,
            batch_id=self.batch.id, medicine_id=medicine.id, requested_quantity=6,
            status="pending_approval",
        )
        self.db.add(self.transfer)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_approval_reserves_stock(self):
        approve_transfer_request(self.db, self.transfer, 6)
        self.db.refresh(self.batch)
        self.assertEqual(self.batch.available_quantity, 4)
        self.assertEqual(self.batch.reserved_quantity, 6)
        self.assertEqual(self.transfer.status, "approved")

    def test_approval_cannot_exceed_request(self):
        with self.assertRaises(HTTPException):
            approve_transfer_request(self.db, self.transfer, 7)
        self.db.refresh(self.batch)
        self.assertEqual(self.batch.available_quantity, 10)
        self.assertEqual(self.batch.reserved_quantity, 0)


if __name__ == "__main__":
    unittest.main()
