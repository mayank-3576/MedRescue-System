import re
from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from app.models.medicine import Medicine
from app.models.batch import MedicineBatch
from app.models.hospital import Hospital
from app.models.alert import ExpiryAlert
from app.models.transfer import TransferRequest
from app.models.demand import DemandRecord
from app.models.audit import AuditLog
from app.services.expiry_service import calculate_days_remaining, determine_risk_level
from app.services.rescue_service import run_rescue_engine
from app.services.delivery_service import haversine_distance


def extract_entity(query: str, pattern: str) -> Optional[str]:
    """Helper to extract entity name from query using regex."""
    match = re.search(pattern, query, re.IGNORECASE)
    if match:
        extracted = match.group(1).strip(" ?.,!\"'")
        return extracted if extracted else None
    return None


def process_assistant_query(
    db: Session,
    query: str,
    hospital_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Process natural language queries using rule-based pattern matching and factual database retrieval.
    Covers over 15 distinct operational medicine, inventory, transfer, and alert intents.
    """
    q = query.strip().lower()
    today = date.today()

    # 1. HELP / CAPABILITIES
    if any(k in q for k in ["help", "what can you do", "commands", "capabilities", "what do you know"]):
        return {
            "query": query,
            "matched_intent": "help",
            "answer": (
                "I am MedRescue System Operational Assistant. You can ask me factual queries such as:\n"
                "• 'Which medicines are expiring soon?'\n"
                "• 'Find stock of Paracetamol' or 'Do we have Amoxicillin?'\n"
                "• 'Show critical alerts'\n"
                "• 'What is our total inventory value?'\n"
                "• 'Which hospital has Metformin?'\n"
                "• 'Show pending transfers'\n"
                "• 'Dosage and strength of Atorvastatin'\n"
                "• 'Show expired batches'\n"
                "• 'List medicines in category Antibiotic'\n"
                "• 'Recommend rescue transfers'\n"
                "• 'Nearest hospital with Omeprazole'\n"
                "• 'Show active demand for Ciprofloxacin'\n"
                "• 'Storage requirements for Insulin or Amoxicillin'\n"
                "• 'Hospital inventory for City General Hospital'\n"
                "• 'Recent audit activity'"
            ),
            "facts": [{"title": "Assistant Version", "data": "MedRescue System Rule Engine v1.0"}],
            "suggested_actions": [
                "Which medicines are expiring soon?",
                "Recommend rescue transfers",
                "Show critical alerts",
                "Total inventory value"
            ]
        }

    # 2. EXPIRING SOON (within 30/60 days)
    if any(k in q for k in ["expiring soon", "expiring this month", "expiry alert", "about to expire", "nearing expiry"]):
        batches = (
            db.query(MedicineBatch)
            .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
            .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
            .filter(
                MedicineBatch.status == "active",
                MedicineBatch.available_quantity > 0,
                MedicineBatch.expiry_date >= today,
            )
        )
        if hospital_id:
            batches = batches.filter(MedicineBatch.hospital_id == hospital_id)
        
        all_batches = batches.order_by(MedicineBatch.expiry_date.asc()).all()
        at_risk = [b for b in all_batches if calculate_days_remaining(b.expiry_date) <= 60]

        if not at_risk:
            return {
                "query": query,
                "matched_intent": "expiring_soon",
                "answer": "Great news! There are currently no active batches expiring within the next 60 days.",
                "facts": [],
                "suggested_actions": ["Recommend rescue transfers", "Total inventory value"]
            }

        facts = [
            {
                "title": f"{b.medicine.name} (Batch {b.batch_number})",
                "data": {
                    "Hospital": b.hospital.name,
                    "Available Quantity": b.available_quantity,
                    "Expiry Date": str(b.expiry_date),
                    "Days Remaining": calculate_days_remaining(b.expiry_date),
                    "Value at Risk": f"₹{b.available_quantity * b.unit_mrp:,.2f}"
                }
            }
            for b in at_risk[:8]
        ]
        return {
            "query": query,
            "matched_intent": "expiring_soon",
            "answer": f"Found {len(at_risk)} active batch(es) expiring within 60 days. Immediate rescue or priority FEFO dispensing is recommended.",
            "facts": facts,
            "suggested_actions": ["Recommend rescue transfers", "Show critical alerts"]
        }

    # 3. CRITICAL ALERTS
    if any(k in q for k in ["critical alert", "critical medicine", "urgent alert", "high risk alert"]):
        alerts = (
            db.query(ExpiryAlert)
            .join(Medicine, ExpiryAlert.medicine_id == Medicine.id)
            .join(Hospital, ExpiryAlert.hospital_id == Hospital.id)
            .join(MedicineBatch, ExpiryAlert.batch_id == MedicineBatch.id)
            .filter(ExpiryAlert.alert_status == "active", ExpiryAlert.risk_level.in_(["critical", "high"]))
        )
        if hospital_id:
            alerts = alerts.filter(ExpiryAlert.hospital_id == hospital_id)

        critical_list = alerts.order_by(ExpiryAlert.days_remaining.asc()).all()

        if not critical_list:
            return {
                "query": query,
                "matched_intent": "critical_alerts",
                "answer": "There are no active critical or high-risk expiry alerts right now.",
                "facts": [],
                "suggested_actions": ["Which medicines are expiring soon?", "Show pending transfers"]
            }

        facts = [
            {
                "title": f"[{a.risk_level.upper()}] {a.medicine.name}",
                "data": {
                    "Batch": a.batch.batch_number,
                    "Hospital": a.hospital.name,
                    "Days Remaining": a.days_remaining,
                    "Available Stock": a.batch.available_quantity,
                    "Value at Risk": f"₹{a.batch.available_quantity * a.batch.unit_mrp:,.2f}"
                }
            }
            for a in critical_list[:8]
        ]
        return {
            "query": query,
            "matched_intent": "critical_alerts",
            "answer": f"Identified {len(critical_list)} active critical/high-urgency alerts requiring immediate action.",
            "facts": facts,
            "suggested_actions": ["Recommend rescue transfers", "Export alerts CSV"]
        }

    # 4. TOTAL INVENTORY VALUE / VALUATION
    if any(k in q for k in ["inventory value", "total value", "stock value", "valuation", "how much stock"]):
        query_batch = db.query(MedicineBatch).filter(MedicineBatch.status == "active")
        if hospital_id:
            query_batch = query_batch.filter(MedicineBatch.hospital_id == hospital_id)
        batches = query_batch.all()

        total_mrp = sum(b.available_quantity * b.unit_mrp for b in batches)
        total_cost = sum(b.available_quantity * b.unit_purchase_cost for b in batches)
        total_units = sum(b.available_quantity for b in batches)
        risk_val = sum(b.available_quantity * b.unit_mrp for b in batches if calculate_days_remaining(b.expiry_date) <= 60)

        h_name = "System-Wide"
        if hospital_id:
            h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
            if h:
                h_name = h.name

        return {
            "query": query,
            "matched_intent": "inventory_valuation",
            "answer": (
                f"{h_name} inventory valuation:\n"
                f"• Total Stock: {total_units:,} units across {len(batches)} active batches\n"
                f"• Total MRP Value: ₹{total_mrp:,.2f}\n"
                f"• Total Purchase Cost Value: ₹{total_cost:,.2f}\n"
                f"• Value at Risk (<= 60 days): ₹{risk_val:,.2f}"
            ),
            "facts": [
                {"title": "Total Units", "data": total_units},
                {"title": "Total MRP Value", "data": f"₹{total_mrp:,.2f}"},
                {"title": "Value at Risk", "data": f"₹{risk_val:,.2f}"},
            ],
            "suggested_actions": ["Which medicines are expiring soon?", "Recommend rescue transfers"]
        }

    # 5. PENDING TRANSFERS
    if any(k in q for k in ["pending transfer", "transfers in progress", "show transfers", "open transfer"]):
        tr_q = (
            db.query(TransferRequest)
            .join(Medicine, TransferRequest.medicine_id == Medicine.id)
            .join(Hospital, TransferRequest.source_hospital_id == Hospital.id)
            .filter(TransferRequest.status.in_(["pending_approval", "approved", "dispatched"]))
        )
        if hospital_id:
            tr_q = tr_q.filter(
                (TransferRequest.source_hospital_id == hospital_id) |
                (TransferRequest.destination_hospital_id == hospital_id)
            )

        transfers = tr_q.order_by(desc(TransferRequest.created_at)).limit(10).all()

        if not transfers:
            return {
                "query": query,
                "matched_intent": "pending_transfers",
                "answer": "There are currently no pending or in-transit transfer requests.",
                "facts": [],
                "suggested_actions": ["Recommend rescue transfers", "Which medicines are expiring soon?"]
            }

        facts = [
            {
                "title": f"Transfer #{t.id} - {t.medicine.name}",
                "data": {
                    "Status": t.status.replace("_", " ").title(),
                    "From": t.source_hospital.name,
                    "To": t.destination_hospital.name if t.destination_hospital else "Unknown",
                    "Qty": t.requested_quantity,
                    "Distance": f"{t.route_distance_km or 0} km",
                    "Est Cost": f"₹{t.delivery_cost or 0:,.2f}"
                }
            }
            for t in transfers
        ]
        return {
            "query": query,
            "matched_intent": "pending_transfers",
            "answer": f"There are {len(transfers)} active transfer requests in progress.",
            "facts": facts,
            "suggested_actions": ["Recommend rescue transfers"]
        }

    # 6. EXPIRED BATCHES
    if any(k in q for k in ["expired batch", "expired medicine", "what has expired", "already expired"]):
        expired_q = (
            db.query(MedicineBatch)
            .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
            .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
            .filter(or_(MedicineBatch.status == "expired", MedicineBatch.expiry_date < today))
        )
        if hospital_id:
            expired_q = expired_q.filter(MedicineBatch.hospital_id == hospital_id)

        expired_batches = expired_q.all()

        if not expired_batches:
            return {
                "query": query,
                "matched_intent": "expired_medicines",
                "answer": "No expired batches were detected in the system.",
                "facts": [],
                "suggested_actions": ["Which medicines are expiring soon?"]
            }

        total_loss = sum(b.available_quantity * b.unit_mrp for b in expired_batches)
        facts = [
            {
                "title": f"{b.medicine.name} (Batch {b.batch_number})",
                "data": {
                    "Hospital": b.hospital.name,
                    "Expired On": str(b.expiry_date),
                    "Quantity": b.available_quantity,
                    "Loss Value": f"₹{b.available_quantity * b.unit_mrp:,.2f}"
                }
            }
            for b in expired_batches[:8]
        ]
        return {
            "query": query,
            "matched_intent": "expired_medicines",
            "answer": f"Found {len(expired_batches)} expired batch(es) totaling ₹{total_loss:,.2f} in expired inventory. These must be quarantined and disposed of per biomedical safety norms.",
            "facts": facts,
            "suggested_actions": ["Which medicines are expiring soon?"]
        }

    # 7. RECOMMEND RESCUE TRANSFERS
    if any(k in q for k in ["recommend rescue", "rescue suggestion", "what to rescue", "rescue engine", "run rescue"]):
        rescue_res = run_rescue_engine(db, hospital_id=hospital_id, limit=5)
        recs = rescue_res["recommendations"]

        if not recs:
            return {
                "query": query,
                "matched_intent": "recommend_rescues",
                "answer": "The rescue engine analyzed all inventory batches and found no feasible transfers meeting safety and positive economic margin criteria at this moment.",
                "facts": [],
                "suggested_actions": ["Which medicines are expiring soon?", "Show critical alerts"]
            }

        facts = [
            {
                "title": f"Rank #{r['recommendation_rank']}: {r['medicine_name']}",
                "data": {
                    "From": r["source_hospital_name"],
                    "To": r["destination_hospital_name"],
                    "Qty": f"{r['recommended_transfer_quantity']} units",
                    "Days Left": r["days_to_expiry"],
                    "Distance": f"{r['estimated_distance_km']} km",
                    "Net Savings": f"₹{r['net_value_saved']:,.2f}",
                    "Score": f"{r['feasibility_score']}/100"
                }
            }
            for r in recs
        ]
        return {
            "query": query,
            "matched_intent": "recommend_rescues",
            "answer": (
                f"Generated {len(recs)} high-priority rescue recommendations! "
                f"Executing these transfers can save ₹{rescue_res['total_potential_value_saved']:,.2f} worth of medicine before expiry."
            ),
            "facts": facts,
            "suggested_actions": ["Show pending transfers", "Show critical alerts"]
        }

    # 8. ACTIVE DEMAND FOR MEDICINE
    if any(k in q for k in ["demand for", "who needs", "required quantity", "medicine demand", "unmet demand"]):
        med_match = extract_entity(query, r"(?:demand for|who needs|unmet demand for)\s+([a-zA-Z0-9\s]+)")
        demand_q = (
            db.query(DemandRecord)
            .join(Medicine, DemandRecord.medicine_id == Medicine.id)
            .join(Hospital, DemandRecord.hospital_id == Hospital.id)
            .filter(DemandRecord.is_active == True)
        )
        if med_match:
            demand_q = demand_q.filter(
                or_(
                    Medicine.name.ilike(f"%{med_match}%"),
                    Medicine.generic_name.ilike(f"%{med_match}%")
                )
            )

        demands = demand_q.all()
        if not demands:
            return {
                "query": query,
                "matched_intent": "medicine_demand",
                "answer": f"No active demand records found" + (f" for '{med_match}'." if med_match else "."),
                "facts": [],
                "suggested_actions": ["Recommend rescue transfers", "Find stock of Paracetamol"]
            }

        facts = [
            {
                "title": f"{d.medicine.name} at {d.hospital.name}",
                "data": {
                    "Priority": d.priority.upper(),
                    "Required Quantity": d.required_quantity,
                    "Hospital City": d.hospital.city,
                    "Notes": d.notes or "None"
                }
            }
            for d in demands[:8]
        ]
        return {
            "query": query,
            "matched_intent": "medicine_demand",
            "answer": f"Found {len(demands)} active demand record(s) logged by partner hospitals.",
            "facts": facts,
            "suggested_actions": ["Recommend rescue transfers"]
        }

    # 9. STORAGE REQUIREMENTS
    if any(k in q for k in ["storage requirement", "storage temperature", "storage condition", "cold chain", "how to store"]):
        med_name = extract_entity(query, r"(?:storage requirements? for|how to store|storage temperature of)\s+([a-zA-Z0-9\s]+)")
        med_q = db.query(Medicine)
        if med_name:
            med_q = med_q.filter(
                or_(Medicine.name.ilike(f"%{med_name}%"), Medicine.generic_name.ilike(f"%{med_name}%"))
            )
        meds = med_q.limit(5).all()

        if not meds:
            return {
                "query": query,
                "matched_intent": "storage_requirements",
                "answer": "Could not identify medicine storage specifications for your query.",
                "facts": [],
                "suggested_actions": ["Help", "Find stock of Amoxicillin"]
            }

        facts = []
        for m in meds:
            # Check batches for storage notes
            batch = db.query(MedicineBatch).filter(MedicineBatch.medicine_id == m.id).first()
            cond = batch.storage_requirements if batch else "Store below 25°C in a dry place"
            facts.append({
                "title": m.name,
                "data": {
                    "Generic": m.generic_name,
                    "Form": m.dosage_form,
                    "Category": m.category,
                    "Storage Conditions": cond
                }
            })

        return {
            "query": query,
            "matched_intent": "storage_requirements",
            "answer": f"Storage specifications for {len(meds)} medicine(s):",
            "facts": facts,
            "suggested_actions": ["Dosage and strength of " + meds[0].name]
        }

    # 10. DOSAGE AND STRENGTH
    if any(k in q for k in ["dosage", "strength", "form of", "how to administer"]):
        med_name = extract_entity(query, r"(?:dosage and strength of|dosage of|strength of|form of)\s+([a-zA-Z0-9\s]+)")
        med_q = db.query(Medicine)
        if med_name:
            med_q = med_q.filter(
                or_(Medicine.name.ilike(f"%{med_name}%"), Medicine.generic_name.ilike(f"%{med_name}%"))
            )
        meds = med_q.limit(5).all()

        if not meds:
            return {
                "query": query,
                "matched_intent": "dosage_strength",
                "answer": "Could not find formulation details matching that medicine name.",
                "facts": [],
                "suggested_actions": ["Help", "List medicines in category Antibiotic"]
            }

        facts = [
            {
                "title": m.name,
                "data": {
                    "Generic Name": m.generic_name,
                    "Dosage Form": m.dosage_form,
                    "Strength": m.strength,
                    "Manufacturer": m.manufacturer,
                    "Category": m.category
                }
            }
            for m in meds
        ]
        return {
            "query": query,
            "matched_intent": "dosage_strength",
            "answer": f"Formulation information for {meds[0].name}:",
            "facts": facts,
            "suggested_actions": [f"Find stock of {meds[0].name}", f"Storage requirements for {meds[0].name}"]
        }

    # 11. CATEGORY MEDICINES (e.g. Antibiotics, Analgesic)
    if any(k in q for k in ["category", "antibiotic", "analgesic", "antidiabetic", "cardiovascular"]):
        cat_match = extract_entity(query, r"(?:category|medicines in|list)\s+([a-zA-Z0-9\s]+)")
        if not cat_match:
            for c in ["antibiotic", "analgesic", "antidiabetic", "antacid", "cardiovascular"]:
                if c in q:
                    cat_match = c
                    break

        cat_q = db.query(Medicine)
        if cat_match:
            cat_q = cat_q.filter(Medicine.category.ilike(f"%{cat_match}%"))
        meds = cat_q.limit(10).all()

        if not meds:
            return {
                "query": query,
                "matched_intent": "category_medicines",
                "answer": f"No medicines found under category '{cat_match}'.",
                "facts": [],
                "suggested_actions": ["Help", "Total inventory value"]
            }

        facts = [
            {
                "title": m.name,
                "data": {
                    "Generic Name": m.generic_name,
                    "Category": m.category,
                    "Strength": m.strength,
                    "Form": m.dosage_form
                }
            }
            for m in meds
        ]
        return {
            "query": query,
            "matched_intent": "category_medicines",
            "answer": f"Found {len(meds)} medicine(s) in category '{meds[0].category}':",
            "facts": facts,
            "suggested_actions": [f"Find stock of {meds[0].name}"]
        }

    # 12. HOSPITAL INVENTORY FOR A GIVEN HOSPITAL
    if any(k in q for k in ["hospital inventory", "inventory for", "what does", "stock at"]):
        hosp_name = extract_entity(query, r"(?:inventory for|what does|stock at)\s+([a-zA-Z0-9\s]+?)(?:have|\?|$)")
        hosp = None
        if hosp_name:
            hosp = db.query(Hospital).filter(Hospital.name.ilike(f"%{hosp_name}%")).first()

        if not hosp and hospital_id:
            hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()

        if not hosp:
            hosp = db.query(Hospital).first()

        if hosp:
            batches = (
                db.query(MedicineBatch)
                .join(Medicine, MedicineBatch.medicine_id == Medicine.id)
                .filter(MedicineBatch.hospital_id == hosp.id, MedicineBatch.status == "active")
                .all()
            )
            tot_units = sum(b.available_quantity for b in batches)
            tot_val = sum(b.available_quantity * b.unit_mrp for b in batches)
            facts = [
                {
                    "title": b.medicine.name,
                    "data": {
                        "Batch": b.batch_number,
                        "Stock": b.available_quantity,
                        "Expiry": str(b.expiry_date),
                        "Days Left": calculate_days_remaining(b.expiry_date),
                    }
                }
                for b in batches[:8]
            ]
            return {
                "query": query,
                "matched_intent": "hospital_inventory",
                "answer": f"Inventory for {hosp.name} ({hosp.city}): {tot_units:,} units available across {len(batches)} batches (Total MRP: ₹{tot_val:,.2f}).",
                "facts": facts,
                "suggested_actions": ["Which medicines are expiring soon?", "Show critical alerts"]
            }

    # 13. NEAREST HOSPITAL WITH MEDICINE
    if any(k in q for k in ["nearest hospital", "closest stock", "nearest stock", "closest hospital"]):
        med_name = extract_entity(query, r"(?:nearest hospital with|closest stock of|nearest stock of)\s+([a-zA-Z0-9\s]+)")
        my_hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first() if hospital_id else db.query(Hospital).first()

        med = None
        if med_name:
            med = db.query(Medicine).filter(or_(Medicine.name.ilike(f"%{med_name}%"), Medicine.generic_name.ilike(f"%{med_name}%"))).first()

        if not med:
            return {
                "query": query,
                "matched_intent": "nearest_stock",
                "answer": f"Please specify a valid medicine name to locate nearest stock.",
                "facts": [],
                "suggested_actions": ["Find stock of Paracetamol", "Which hospital has Amoxicillin"]
            }

        other_batches = (
            db.query(MedicineBatch)
            .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
            .filter(
                MedicineBatch.medicine_id == med.id,
                MedicineBatch.hospital_id != (my_hospital.id if my_hospital else 0),
                MedicineBatch.status == "active",
                MedicineBatch.available_quantity > 0,
            )
            .all()
        )

        if not other_batches or not my_hospital:
            return {
                "query": query,
                "matched_intent": "nearest_stock",
                "answer": f"No other hospitals currently have available stock of {med.name}.",
                "facts": [],
                "suggested_actions": ["Help"]
            }

        ranked_hospitals = []
        for b in other_batches:
            dist = haversine_distance(my_hospital.latitude, my_hospital.longitude, b.hospital.latitude, b.hospital.longitude)
            ranked_hospitals.append((dist, b.hospital, b))

        ranked_hospitals.sort(key=lambda x: x[0])
        nearest = ranked_hospitals[0]

        facts = [
            {
                "title": nearest[1].name,
                "data": {
                    "City": nearest[1].city,
                    "Distance": f"{nearest[0]:,.1f} km from {my_hospital.name}",
                    "Available Stock": f"{nearest[2].available_quantity} units",
                    "Batch": nearest[2].batch_number,
                    "Expiry": str(nearest[2].expiry_date)
                }
            }
        ]
        return {
            "query": query,
            "matched_intent": "nearest_stock",
            "answer": f"The nearest facility with {med.name} stock is {nearest[1].name} in {nearest[1].city} ({nearest[0]:,.1f} km away).",
            "facts": facts,
            "suggested_actions": [f"Which hospital has {med.name}", "Recommend rescue transfers"]
        }

    # 14. AUDIT LOG SUMMARY / RECENT ACTIVITY
    if any(k in q for k in ["audit log", "recent activity", "who changed", "activity log", "audit trail"]):
        logs = db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(6).all()
        if not logs:
            return {
                "query": query,
                "matched_intent": "audit_log_summary",
                "answer": "No recent audit activity records found.",
                "facts": [],
                "suggested_actions": ["Help"]
            }

        facts = [
            {
                "title": f"{l.action} on {l.entity_type} #{l.entity_id or ''}",
                "data": {
                    "Timestamp": l.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "User ID": l.user_id or "System",
                    "IP": l.ip_address or "Internal"
                }
            }
            for l in logs
        ]
        return {
            "query": query,
            "matched_intent": "audit_log_summary",
            "answer": f"Retrieved {len(logs)} most recent audit records from the operational ledger:",
            "facts": facts,
            "suggested_actions": ["Help", "Show pending transfers"]
        }

    # 15. WHICH HOSPITAL HAS {MEDICINE} / LOCATION
    if any(k in q for k in ["which hospital has", "who has", "where is"]):
        med_name = extract_entity(query, r"(?:which hospital has|who has|where is)\s+([a-zA-Z0-9\s]+)")
        med = None
        if med_name:
            med = db.query(Medicine).filter(
                or_(Medicine.name.ilike(f"%{med_name}%"), Medicine.generic_name.ilike(f"%{med_name}%"))
            ).first()

        if not med:
            return {
                "query": query,
                "matched_intent": "medicine_location",
                "answer": f"Could not find a registered medicine matching '{med_name or query}'.",
                "facts": [],
                "suggested_actions": ["Help", "Which medicines are expiring soon?"]
            }

        batches = (
            db.query(MedicineBatch)
            .join(Hospital, MedicineBatch.hospital_id == Hospital.id)
            .filter(
                MedicineBatch.medicine_id == med.id,
                MedicineBatch.status == "active",
                MedicineBatch.available_quantity > 0,
            )
            .all()
        )

        if not batches:
            return {
                "query": query,
                "matched_intent": "medicine_location",
                "answer": f"There is currently zero active stock of {med.name} across all hospitals.",
                "facts": [],
                "suggested_actions": [f"Total demand for {med.name}"]
            }

        facts = [
            {
                "title": b.hospital.name,
                "data": {
                    "City": b.hospital.city,
                    "Batch": b.batch_number,
                    "Stock": b.available_quantity,
                    "Expiry": str(b.expiry_date)
                }
            }
            for b in batches
        ]
        return {
            "query": query,
            "matched_intent": "medicine_location",
            "answer": f"{med.name} ({med.strength}) is available at {len(batches)} location(s):",
            "facts": facts,
            "suggested_actions": [f"Find stock of {med.name}", "Recommend rescue transfers"]
        }

    # 16. FIND STOCK OF {MEDICINE} / DO WE HAVE {MEDICINE}
    med_name = extract_entity(query, r"(?:find stock of|stock of|stock for|do we have|search for|look up|info on)\s+([a-zA-Z0-9\s]+)")
    if med_name or any(k in q for k in ["stock", "have"]):
        search_term = med_name or q.replace("stock", "").replace("have", "").replace("find", "").strip()
        med = db.query(Medicine).filter(
            or_(Medicine.name.ilike(f"%{search_term}%"), Medicine.generic_name.ilike(f"%{search_term}%"))
        ).first()

        if med:
            batches_q = db.query(MedicineBatch).filter(MedicineBatch.medicine_id == med.id, MedicineBatch.status == "active")
            if hospital_id:
                batches_q = batches_q.filter(MedicineBatch.hospital_id == hospital_id)
            batches = batches_q.all()

            total_qty = sum(b.available_quantity for b in batches)
            facts = [
                {
                    "title": f"Batch {b.batch_number}",
                    "data": {
                        "Hospital": b.hospital.name,
                        "Available": b.available_quantity,
                        "MRP": f"₹{b.unit_mrp}",
                        "Expiry": str(b.expiry_date),
                        "Days Left": calculate_days_remaining(b.expiry_date)
                    }
                }
                for b in batches
            ]
            return {
                "query": query,
                "matched_intent": "medicine_stock",
                "answer": f"{med.name} ({med.strength}, {med.dosage_form}): {total_qty} units available across {len(batches)} active batch(es).",
                "facts": facts,
                "suggested_actions": [
                    f"Dosage and strength of {med.name}",
                    f"Which hospital has {med.name}",
                    f"Storage requirements for {med.name}"
                ]
            }

    # DEFAULT FALLBACK
    return {
        "query": query,
        "matched_intent": "unknown",
        "answer": (
            "I could not recognize that specific query. You can ask about expiring medicines, "
            "search stock of any medicine (e.g. 'find stock of Paracetamol'), check critical alerts, "
            "recommend rescue transfers, or type 'help' for examples."
        ),
        "facts": [],
        "suggested_actions": [
            "Which medicines are expiring soon?",
            "Recommend rescue transfers",
            "Show critical alerts",
            "Help"
        ]
    }
