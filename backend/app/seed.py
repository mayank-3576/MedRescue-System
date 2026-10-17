"""
MedRescue System - Idempotent Database Seed Script
=============================================
Labels all test artifacts with DEMO DATA markers.
Populates standard hospitals, catalog medicines, diverse risk-tier batches,
active cross-facility demands, state-machine transfers, and operational settings.
"""

from typing import Optional
from datetime import date, timedelta, datetime
import logging
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.hospital import Hospital
from app.models.medicine import Medicine
from app.models.batch import MedicineBatch
from app.models.demand import DemandRecord
from app.models.transfer import TransferRequest
from app.models.delivery import DeliveryEstimate
from app.models.setting import ApplicationSetting
from app.auth.security import get_password_hash
from app.services.expiry_service import refresh_all_alerts
from app.services.delivery_service import calculate_route_sync

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")


def seed_database(db: Optional[Session] = None) -> None:
    """Idempotently seed the MedRescue database with complete demo datasets."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        logger.info(">>> Starting MedRescue System DEMO DATA Seed Process...")

        # -------------------------------------------------------------
        # 1. Application Settings
        # -------------------------------------------------------------
        default_settings = [
            ("cost_per_km", "15.0", "Logistics delivery rate per kilometer (INR)", "logistics"),
            ("fixed_delivery_charge", "500.0", "Fixed minimum delivery charge per transfer (INR)", "logistics"),
            ("min_shelf_life_days", "30", "Minimum shelf life days remaining required for rescue transfer", "rescue"),
            ("max_delivery_radius_km", "800.0", "Maximum inter-facility transit radius for rescue engine", "rescue"),
            ("alert_check_interval_hours", "24", "Periodic batch expiry scan interval in hours", "system"),
        ]

        for key, val, desc, cat in default_settings:
            existing = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
            if not existing:
                db.add(ApplicationSetting(key=key, value=val, description=desc, category=cat))
            else:
                existing.value = val
                existing.description = desc
                existing.category = cat
        db.commit()
        logger.info("✓ Application settings configured.")

        # -------------------------------------------------------------
        # 2. Hospitals (Real Indian coordinates)
        # -------------------------------------------------------------
        hospitals_data = [
            {
                "name": "City General Hospital",
                "code": "CGH-MUM",
                "pmjay_hospital_id": "HOSP-DEL-001",
                "pmjay_verification_status": "verified_registry",
                "bed_capacity": 500,
                "address": "Dr. E Moses Road, Worli",
                "city": "Mumbai",
                "state": "Maharashtra",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "contact_phone": "+91-22-2493-0001",
                "contact_email": "mumbai.general@medrescue.demo",
            },
            {
                "name": "Metro Health Center",
                "code": "MHC-DEL",
                "pmjay_hospital_id": "HOSP-DEL-002",
                "pmjay_verification_status": "verified_registry",
                "bed_capacity": 350,
                "address": "Ansari Nagar East, Ring Road",
                "city": "Delhi",
                "state": "Delhi",
                "latitude": 28.6139,
                "longitude": 77.2090,
                "contact_phone": "+91-11-2658-0002",
                "contact_email": "delhi.metro@medrescue.demo",
            },
            {
                "name": "Sunrise Medical College",
                "code": "SMC-BLR",
                "pmjay_hospital_id": "HOSP-BLR-003",
                "pmjay_verification_status": "verified_registry",
                "bed_capacity": 650,
                "address": "Victoria Hospital Complex, Fort",
                "city": "Bangalore",
                "state": "Karnataka",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "contact_phone": "+91-80-2670-0003",
                "contact_email": "bangalore.sunrise@medrescue.demo",
            },
            {
                "name": "Lakeside Community Hospital",
                "code": "LCH-CHE",
                "pmjay_hospital_id": "HOSP-CHE-004",
                "pmjay_verification_status": "verified_registry",
                "bed_capacity": 250,
                "address": "EVR Periyar Salai, Park Town",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "latitude": 13.0827,
                "longitude": 80.2707,
                "contact_phone": "+91-44-2530-0004",
                "contact_email": "chennai.lakeside@medrescue.demo",
            },
            {
                "name": "Highland District Hospital",
                "code": "HDH-HYD",
                "pmjay_hospital_id": "HOSP-HYD-005",
                "pmjay_verification_status": "verified_registry",
                "bed_capacity": 400,
                "address": "Afzal Gunj, Osmania Hospital Rd",
                "city": "Hyderabad",
                "state": "Telangana",
                "latitude": 17.3850,
                "longitude": 78.4867,
                "contact_phone": "+91-40-2460-0005",
                "contact_email": "hyderabad.highland@medrescue.demo",
            },
        ]

        hospitals_map = {}
        for h_info in hospitals_data:
            h = db.query(Hospital).filter(Hospital.name == h_info["name"]).first()
            if not h:
                h = Hospital(**h_info)
                db.add(h)
                db.flush()
            else:
                for k, v in h_info.items():
                    setattr(h, k, v)
                db.add(h)
                db.flush()
            hospitals_map[h.name] = h
        db.commit()
        logger.info(f"✓ Seeded {len(hospitals_map)} hospitals with real Indian coordinates.")

        # -------------------------------------------------------------
        # 3. Users (1 Admin, 2 Staff)
        # -------------------------------------------------------------
        users_data = [
            {
                "email": "admin@medrescue.com",
                "full_name": "Dr. Rajesh Sharma (Admin)",
                "password": "Admin123!",
                "role": "admin",
                "hospital_id": None,
            },
            {
                "email": "staff@medrescue.com",
                "full_name": "Priya Nair (Mumbai Staff)",
                "password": "Staff123!",
                "role": "staff",
                "hospital_id": hospitals_map["City General Hospital"].id,
            },
            {
                "email": "staff2@medrescue.com",
                "full_name": "Amit Verma (Delhi Staff)",
                "password": "Staff123!",
                "role": "staff",
                "hospital_id": hospitals_map["Metro Health Center"].id,
            },
        ]

        users_map = {}
        for u_info in users_data:
            u = db.query(User).filter(User.email == u_info["email"]).first()
            hashed = get_password_hash(u_info["password"])
            if not u:
                u = User(
                    email=u_info["email"],
                    full_name=u_info["full_name"],
                    hashed_password=hashed,
                    role=u_info["role"],
                    hospital_id=u_info["hospital_id"],
                    is_active=True,
                )
                db.add(u)
                db.flush()
            else:
                u.full_name = u_info["full_name"]
                u.hashed_password = hashed
                u.role = u_info["role"]
                u.hospital_id = u_info["hospital_id"]
                u.is_active = True
                db.add(u)
                db.flush()
            users_map[u.email] = u
        db.commit()
        logger.info("✓ Seeded Admin and Staff user accounts.")

        # -------------------------------------------------------------
        # 4. Medicines (15+ Catalog Entries)
        # -------------------------------------------------------------
        medicines_data = [
            ("Paracetamol", "Acetaminophen", "Tablet", "500mg", "Cipla Ltd", "Analgesic", "MED-PCM-500"),
            ("Amoxicillin", "Amoxicillin Trihydrate", "Capsule", "500mg", "Sun Pharma", "Antibiotic", "MED-AMX-500"),
            ("Metformin", "Metformin Hydrochloride", "Tablet", "500mg", "Dr. Reddy's", "Antidiabetic", "MED-MET-500"),
            ("Omeprazole", "Omeprazole Magnesium", "Capsule", "20mg", "Lupin Ltd", "Antacid", "MED-OMP-20"),
            ("Aspirin", "Acetylsalicylic Acid", "Tablet", "75mg", "Bayer India", "Cardiovascular", "MED-ASP-75"),
            ("Ciprofloxacin", "Ciprofloxacin HCl", "Tablet", "500mg", "Torrent Pharma", "Antibiotic", "MED-CIP-500"),
            ("Ibuprofen", "Ibuprofen", "Tablet", "400mg", "Abbott India", "Analgesic", "MED-IBU-400"),
            ("Cetirizine", "Cetirizine Dihydrochloride", "Tablet", "10mg", "Zydus Lifesciences", "Antihistamine", "MED-CET-10"),
            ("Azithromycin", "Azithromycin Dihydrate", "Tablet", "500mg", "Alembic Pharma", "Antibiotic", "MED-AZI-500"),
            ("Losartan", "Losartan Potassium", "Tablet", "50mg", "Glenmark", "Cardiovascular", "MED-LOS-50"),
            ("Atorvastatin", "Atorvastatin Calcium", "Tablet", "10mg", "Sun Pharma", "Cardiovascular", "MED-ATO-10"),
            ("Clopidogrel", "Clopidogrel Bisulfate", "Tablet", "75mg", "Sanofi India", "Cardiovascular", "MED-CLP-75"),
            ("Pantoprazole", "Pantoprazole Sodium", "Tablet", "40mg", "Alkem Labs", "Antacid", "MED-PAN-40"),
            ("Metoprolol", "Metoprolol Succinate", "Tablet", "25mg", "AstraZeneca India", "Cardiovascular", "MED-MET-25"),
            ("Amlodipine", "Amlodipine Besylate", "Tablet", "5mg", "Pfizer India", "Cardiovascular", "MED-AML-5"),
            ("Insulin Glargine", "Recombinant Human Insulin", "Injection", "100IU/ml", "Biocon", "Antidiabetic", "MED-INS-100"),
        ]

        medicines_map = {}
        for name, gen, form, strn, mfg, cat, bar in medicines_data:
            m = db.query(Medicine).filter(Medicine.barcode == bar).first()
            if not m:
                m = db.query(Medicine).filter(Medicine.name == name).first()
            if not m:
                m = Medicine(
                    name=name,
                    generic_name=gen,
                    dosage_form=form,
                    strength=strn,
                    manufacturer=mfg,
                    category=cat,
                    barcode=bar,
                )
                db.add(m)
                db.flush()
            else:
                m.name = name
                m.generic_name = gen
                m.dosage_form = form
                m.strength = strn
                m.manufacturer = mfg
                m.category = cat
                m.barcode = bar
                db.add(m)
                db.flush()
            medicines_map[name] = m
        db.commit()
        logger.info(f"✓ Seeded {len(medicines_map)} catalog medicines.")

        # -------------------------------------------------------------
        # 5. Batches (40+ Batches with diverse expiry dates)
        # -------------------------------------------------------------
        today = date.today()
        h_names = list(hospitals_map.keys())
        m_names = list(medicines_map.keys())

        # Specific targeted batches to guarantee every risk level exists:
        # - Expired (-15 days, -45 days)
        # - Critical (3 days, 5 days)
        # - High (12 days, 22 days)
        # - Medium (38 days, 52 days)
        # - Low (70 days, 85 days)
        # - Normal (180 days, 360 days)
        batch_configs = [
            # EXPIRED
            ("EXP-001", "Paracetamol", "City General Hospital", 300, 0, 2.5, 1.2, -180, -20, "Store below 25°C", "expired"),
            ("EXP-002", "Amoxicillin", "Metro Health Center", 150, 0, 8.0, 4.5, -200, -10, "Store below 25°C", "expired"),
            ("EXP-003", "Ciprofloxacin", "Sunrise Medical College", 220, 0, 12.0, 6.0, -150, -5, "Store below 25°C", "expired"),
            
            # CRITICAL (1 - 7 days)
            ("CRT-101", "Amoxicillin", "City General Hospital", 600, 0, 8.5, 4.2, -120, 3, "Store below 25°C", "active"),
            ("CRT-102", "Azithromycin", "Metro Health Center", 450, 0, 22.0, 11.5, -100, 5, "Store below 25°C", "active"),
            ("CRT-103", "Pantoprazole", "Sunrise Medical College", 800, 0, 7.5, 3.8, -130, 6, "Store below 25°C", "active"),
            ("CRT-104", "Metformin", "Highland District Hospital", 900, 0, 4.0, 1.9, -150, 2, "Store below 25°C", "active"),
            ("CRT-105", "Insulin Glargine", "Lakeside Community Hospital", 80, 0, 450.0, 280.0, -60, 4, "Store between 2-8°C Refrigerated", "active"),

            # HIGH (8 - 30 days)
            ("HIG-201", "Omeprazole", "City General Hospital", 1200, 0, 6.5, 3.1, -90, 14, "Store below 25°C", "active"),
            ("HIG-202", "Atorvastatin", "Metro Health Center", 500, 0, 14.0, 7.0, -80, 19, "Store below 25°C", "active"),
            ("HIG-203", "Amlodipine", "Sunrise Medical College", 750, 0, 3.5, 1.5, -110, 25, "Store below 25°C", "active"),
            ("HIG-204", "Clopidogrel", "Lakeside Community Hospital", 400, 0, 18.0, 9.2, -75, 21, "Store below 25°C", "active"),
            ("HIG-205", "Ibuprofen", "Highland District Hospital", 650, 0, 3.0, 1.2, -100, 28, "Store below 25°C", "active"),
            ("HIG-206", "Paracetamol", "Metro Health Center", 1500, 0, 2.5, 1.1, -95, 16, "Store below 25°C", "active"),
            ("HIG-207", "Ciprofloxacin", "City General Hospital", 350, 0, 12.0, 6.2, -85, 27, "Store below 25°C", "active"),

            # MEDIUM (31 - 60 days)
            ("MED-301", "Metoprolol", "City General Hospital", 550, 0, 8.0, 3.9, -70, 35, "Store below 25°C", "active"),
            ("MED-302", "Losartan", "Sunrise Medical College", 700, 0, 9.5, 4.5, -80, 42, "Store below 25°C", "active"),
            ("MED-303", "Cetirizine", "Metro Health Center", 1100, 0, 4.2, 1.8, -90, 48, "Store below 25°C", "active"),
            ("MED-304", "Amoxicillin", "Lakeside Community Hospital", 950, 0, 8.5, 4.1, -65, 55, "Store below 25°C", "active"),
            ("MED-305", "Pantoprazole", "Highland District Hospital", 600, 0, 7.5, 3.6, -85, 39, "Store below 25°C", "active"),
            ("MED-306", "Aspirin", "City General Hospital", 1300, 0, 2.0, 0.8, -120, 50, "Store below 25°C", "active"),
            ("MED-307", "Metformin", "Metro Health Center", 850, 0, 4.0, 1.9, -75, 45, "Store below 25°C", "active"),

            # LOW (61 - 90 days)
            ("LOW-401", "Azithromycin", "Sunrise Medical College", 400, 0, 22.0, 11.0, -50, 68, "Store below 25°C", "active"),
            ("LOW-402", "Atorvastatin", "City General Hospital", 650, 0, 14.0, 7.0, -60, 74, "Store below 25°C", "active"),
            ("LOW-403", "Clopidogrel", "Highland District Hospital", 380, 0, 18.0, 9.0, -70, 82, "Store below 25°C", "active"),
            ("LOW-404", "Omeprazole", "Metro Health Center", 800, 0, 6.5, 3.0, -60, 78, "Store below 25°C", "active"),
            ("LOW-405", "Insulin Glargine", "Sunrise Medical College", 120, 0, 450.0, 275.0, -45, 65, "Store between 2-8°C Refrigerated", "active"),
            ("LOW-406", "Ibuprofen", "Lakeside Community Hospital", 900, 0, 3.0, 1.3, -55, 88, "Store below 25°C", "active"),

            # NORMAL (90+ days)
            ("NOR-501", "Paracetamol", "City General Hospital", 5000, 0, 2.5, 1.0, -30, 240, "Store below 25°C", "active"),
            ("NOR-502", "Amoxicillin", "Metro Health Center", 3000, 0, 8.5, 3.9, -20, 300, "Store below 25°C", "active"),
            ("NOR-503", "Metformin", "Sunrise Medical College", 4000, 0, 4.0, 1.8, -40, 270, "Store below 25°C", "active"),
            ("NOR-504", "Omeprazole", "Highland District Hospital", 2500, 0, 6.5, 3.0, -15, 360, "Store below 25°C", "active"),
            ("NOR-505", "Aspirin", "Lakeside Community Hospital", 4500, 0, 2.0, 0.7, -25, 320, "Store below 25°C", "active"),
            ("NOR-506", "Ciprofloxacin", "City General Hospital", 2000, 0, 12.0, 5.8, -35, 180, "Store below 25°C", "active"),
            ("NOR-507", "Cetirizine", "Metro Health Center", 3500, 0, 4.2, 1.7, -10, 310, "Store below 25°C", "active"),
            ("NOR-508", "Azithromycin", "Highland District Hospital", 1500, 0, 22.0, 10.5, -20, 210, "Store below 25°C", "active"),
            ("NOR-509", "Losartan", "Lakeside Community Hospital", 2200, 0, 9.5, 4.2, -30, 290, "Store below 25°C", "active"),
            ("NOR-510", "Atorvastatin", "Sunrise Medical College", 1800, 0, 14.0, 6.8, -15, 340, "Store below 25°C", "active"),
            ("NOR-511", "Clopidogrel", "City General Hospital", 1600, 0, 18.0, 8.8, -25, 260, "Store below 25°C", "active"),
            ("NOR-512", "Pantoprazole", "Metro Health Center", 2800, 0, 7.5, 3.4, -40, 280, "Store below 25°C", "active"),
            ("NOR-513", "Metoprolol", "Highland District Hospital", 1400, 0, 8.0, 3.7, -30, 250, "Store below 25°C", "active"),
            ("NOR-514", "Amlodipine", "Lakeside Community Hospital", 2600, 0, 3.5, 1.4, -20, 330, "Store below 25°C", "active"),
        ]

        batches_map = {}
        for b_num, m_name, h_name, avail, res, mrp, cost, mfg_offset, exp_offset, storage, stat in batch_configs:
            m = medicines_map[m_name]
            h = hospitals_map[h_name]
            mfg_date = today + timedelta(days=mfg_offset)
            exp_date = today + timedelta(days=exp_offset)

            batch = db.query(MedicineBatch).filter(MedicineBatch.batch_number == b_num).first()
            if not batch:
                batch = MedicineBatch(
                    medicine_id=m.id,
                    hospital_id=h.id,
                    batch_number=b_num,
                    available_quantity=avail,
                    reserved_quantity=res,
                    unit_mrp=mrp,
                    unit_purchase_cost=cost,
                    manufacturing_date=mfg_date,
                    expiry_date=exp_date,
                    storage_requirements=storage,
                    status=stat,
                    is_demo=True,
                )
                db.add(batch)
                db.flush()
            else:
                batch.medicine_id = m.id
                batch.hospital_id = h.id
                batch.available_quantity = avail
                batch.reserved_quantity = res
                batch.unit_mrp = mrp
                batch.unit_purchase_cost = cost
                batch.manufacturing_date = mfg_date
                batch.expiry_date = exp_date
                batch.storage_requirements = storage
                batch.status = stat
                batch.is_demo = True
                db.add(batch)
                db.flush()
            batches_map[b_num] = batch
        db.commit()
        logger.info(f"✓ Seeded {len(batches_map)} medicine batches across 6 expiry risk tiers.")

        # -------------------------------------------------------------
        # 6. Demand Records (Matching at-risk stock)
        # -------------------------------------------------------------
        demands_data = [
            ("Metro Health Center", "Amoxicillin", 400, "critical", "DEMO: Critical pediatric shortage after outbreak"),
            ("City General Hospital", "Azithromycin", 300, "high", "DEMO: Post-surgical antibiotic requirement"),
            ("Lakeside Community Hospital", "Metformin", 500, "high", "DEMO: Outpatient diabetes clinic deficit"),
            ("Sunrise Medical College", "Omeprazole", 600, "medium", "DEMO: Inpatient ICU gastro-protection restock"),
            ("Highland District Hospital", "Atorvastatin", 350, "medium", "DEMO: Cardiology cardiology OPD shortage"),
            ("City General Hospital", "Insulin Glargine", 60, "critical", "DEMO: Critical insulin shortage for ICU patients"),
            ("Metro Health Center", "Pantoprazole", 450, "low", "DEMO: Routine gastro prophylaxis buffer"),
        ]

        for h_name, m_name, qty, prio, note in demands_data:
            h = hospitals_map[h_name]
            m = medicines_map[m_name]
            existing_dem = (
                db.query(DemandRecord)
                .filter(DemandRecord.hospital_id == h.id, DemandRecord.medicine_id == m.id, DemandRecord.is_active == True)
                .first()
            )
            if not existing_dem:
                dem = DemandRecord(
                    hospital_id=h.id,
                    medicine_id=m.id,
                    required_quantity=qty,
                    priority=prio,
                    notes=note,
                    is_active=True,
                )
                db.add(dem)
        db.commit()
        logger.info(f"✓ Seeded {len(demands_data)} hospital demand records.")

        # -------------------------------------------------------------
        # 7. Transfers in Diverse States
        # -------------------------------------------------------------
        # To demonstrate the state machine:
        # Transfer 1: pending_approval
        # Transfer 2: approved (with stock reserved)
        # Transfer 3: dispatched (in-transit)
        # Transfer 4: received (completed)
        # Transfer 5: cancelled
        admin_u = users_map["admin@medrescue.com"]
        mumbai_staff = users_map["staff@medrescue.com"]

        sample_transfers = [
            {
                "src": "City General Hospital",
                "dst": "Metro Health Center",
                "batch": "HIG-201",  # Omeprazole
                "qty": 300,
                "appr_qty": 0,
                "disp_qty": 0,
                "recv_qty": 0,
                "status": "pending_approval",
                "notes": "DEMO: Urgent transfer requested from Mumbai to Delhi.",
            },
            {
                "src": "Sunrise Medical College",
                "dst": "Lakeside Community Hospital",
                "batch": "HIG-203",  # Amlodipine
                "qty": 200,
                "appr_qty": 200,
                "disp_qty": 0,
                "recv_qty": 0,
                "status": "approved",
                "notes": "DEMO: Approved by Bangalore pharmacist. Awaiting pickup.",
            },
            {
                "src": "Metro Health Center",
                "dst": "Highland District Hospital",
                "batch": "HIG-202",  # Atorvastatin
                "qty": 150,
                "appr_qty": 150,
                "disp_qty": 150,
                "recv_qty": 0,
                "status": "dispatched",
                "notes": "DEMO: In transit via temperature-controlled courier.",
            },
            {
                "src": "Lakeside Community Hospital",
                "dst": "Sunrise Medical College",
                "batch": "NOR-505",  # Aspirin
                "qty": 500,
                "appr_qty": 500,
                "disp_qty": 500,
                "recv_qty": 500,
                "status": "received",
                "notes": "DEMO: Successfully received and verified at Bangalore pharmacy.",
            },
            {
                "src": "Highland District Hospital",
                "dst": "City General Hospital",
                "batch": "HIG-205",  # Ibuprofen
                "qty": 100,
                "appr_qty": 0,
                "disp_qty": 0,
                "recv_qty": 0,
                "status": "cancelled",
                "notes": "DEMO: Cancelled due to localized supply restock.",
            },
        ]

        for t_spec in sample_transfers:
            src_h = hospitals_map[t_spec["src"]]
            dst_h = hospitals_map[t_spec["dst"]]
            b = batches_map[t_spec["batch"]]

            existing_t = (
                db.query(TransferRequest)
                .filter(
                    TransferRequest.source_hospital_id == src_h.id,
                    TransferRequest.destination_hospital_id == dst_h.id,
                    TransferRequest.batch_id == b.id,
                )
                .first()
            )

            if not existing_t:
                route_res = calculate_route_sync(src_h.latitude, src_h.longitude, dst_h.latitude, dst_h.longitude, db=db)
                t_obj = TransferRequest(
                    source_hospital_id=src_h.id,
                    destination_hospital_id=dst_h.id,
                    batch_id=b.id,
                    medicine_id=b.medicine_id,
                    requested_quantity=t_spec["qty"],
                    approved_quantity=t_spec["appr_qty"],
                    dispatched_quantity=t_spec["disp_qty"],
                    received_quantity=t_spec["recv_qty"],
                    status=t_spec["status"],
                    route_distance_km=route_res["distance_km"],
                    delivery_cost=route_res["estimated_cost"],
                    is_road_distance=route_res["is_road_distance"],
                    requested_by=mumbai_staff.id,
                    approved_by=admin_u.id if t_spec["status"] in ["approved", "dispatched", "received"] else None,
                    notes=t_spec["notes"],
                    created_at=datetime.utcnow() - timedelta(days=2),
                    updated_at=datetime.utcnow(),
                )
                db.add(t_obj)
                db.flush()

                # If status is approved, reserve the stock in batch
                if t_spec["status"] == "approved":
                    b.reserved_quantity += t_spec["appr_qty"]
                    b.available_quantity = max(0, b.available_quantity - t_spec["appr_qty"])
                    db.add(b)

                # Add DeliveryEstimate
                db.add(DeliveryEstimate(
                    transfer_id=t_obj.id,
                    source_hospital_id=src_h.id,
                    destination_hospital_id=dst_h.id,
                    distance_km=route_res["distance_km"],
                    is_road_distance=route_res["is_road_distance"],
                    cost_per_km=route_res["cost_per_km"],
                    fixed_charge=route_res["fixed_charge"],
                    estimated_cost=route_res["estimated_cost"],
                    created_at=datetime.utcnow(),
                ))
        db.commit()
        logger.info("✓ Seeded sample transfers across state-machine lifecycle.")

        # -------------------------------------------------------------
        # 8. Refresh Expiry Alerts
        # -------------------------------------------------------------
        logger.info("Refreshing expiry alerts for all active batches...")
        total_alerts = refresh_all_alerts(db)
        logger.info(f"✓ Generated/updated {total_alerts} real-time expiry alerts.")

        logger.info("=============================================================")
        logger.info("MedRescue System DEMO DATA Seed completed successfully!")
        logger.info("Default Login Credentials:")
        logger.info("  Admin: admin@medrescue.com / Admin123!")
        logger.info("  Staff: staff@medrescue.com / Staff123! (City General Hospital)")
        logger.info("  Staff: staff2@medrescue.com / Staff123! (Metro Health Center)")
        logger.info("=============================================================")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during database seed: {e}", exc_info=True)
        raise
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_database()
