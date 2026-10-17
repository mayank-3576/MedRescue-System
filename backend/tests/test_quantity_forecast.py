import unittest
from datetime import date, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Hospital, Medicine, DemandRecord, MedicineBatch
from app.services.quantity_forecast_service import predict_quantity


class QuantityForecastTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.hospital = Hospital(name="Forecast Hospital", address="A", city="Delhi", state="Delhi", latitude=28.6, longitude=77.2, bed_capacity=100)
        self.medicine = Medicine(name="Forecast Medicine", generic_name="Forecast Medicine", dosage_form="tablet", strength="10mg", manufacturer="Test", category="Test")
        self.db.add_all([self.hospital, self.medicine])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_sparse_history_does_not_return_a_guessed_quantity(self):
        result = predict_quantity(self.db, self.hospital.id, self.medicine.id, 30)
        self.assertIsNone(result["forecast_quantity"])
        self.assertEqual(result["data_support"], "insufficient")

    def test_history_supports_explainable_stock_adjusted_estimate(self):
        for index in range(8):
            observed = date.today() - timedelta(days=index * 35)
            self.db.add(DemandRecord(
                hospital_id=self.hospital.id,
                medicine_id=self.medicine.id,
                required_quantity=10,
                original_quantity=10,
                priority="medium",
                demand_date=observed,
                created_at=datetime.utcnow(),
                is_active=True,
            ))
        self.db.add(MedicineBatch(
            hospital_id=self.hospital.id,
            medicine_id=self.medicine.id,
            batch_number="FORECAST-LOT",
            available_quantity=20,
            reserved_quantity=0,
            unit_mrp=10,
            unit_purchase_cost=5,
            manufacturing_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=300),
            status="active",
        ))
        self.db.commit()
        result = predict_quantity(self.db, self.hospital.id, self.medicine.id, 30)
        self.assertGreater(result["forecast_quantity"], 0)
        self.assertEqual(result["recommended_replenishment"], max(0, result["forecast_quantity"] - 20))
        self.assertIn("Forecast =", result["explanation"])


if __name__ == "__main__":
    unittest.main()
