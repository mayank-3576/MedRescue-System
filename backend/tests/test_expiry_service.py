from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.models.alert import ExpiryAlert
from app.services import expiry_service as es


def make_batch(days_from_today, status="active"):
    return SimpleNamespace(
        id=1,
        hospital_id=10,
        medicine_id=20,
        expiry_date=date.today() + timedelta(days=days_from_today),
        status=status,
    )


def make_db(existing_alert=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing_alert
    return db


def test_calculate_days_remaining_future():
    assert es.calculate_days_remaining(date.today() + timedelta(days=15)) == 15


def test_calculate_days_remaining_today_is_zero():
    assert es.calculate_days_remaining(date.today()) == 0


def test_calculate_days_remaining_past_is_negative():
    assert es.calculate_days_remaining(date.today() - timedelta(days=3)) == -3


@pytest.mark.parametrize(
    "days, expected",
    [
        (-5, "expired"), (0, "expired"),
        (1, "critical"), (7, "critical"),
        (8, "high"), (30, "high"),
        (31, "medium"), (60, "medium"),
        (61, "low"), (90, "low"),
        (91, "normal"), (365, "normal"),
    ],
)
def test_determine_risk_level_boundaries(days, expected):
    assert es.determine_risk_level(days) == expected


def test_get_batch_risk_returns_days_and_level():
    days, risk = es.get_batch_risk(make_batch(5))
    assert days == 5
    assert risk == "critical"


def test_sync_creates_new_alert_for_at_risk_batch():
    db = make_db(existing_alert=None)
    alert = es.sync_batch_alert(db, make_batch(5))
    assert isinstance(alert, ExpiryAlert)
    assert alert.risk_level == "critical"
    assert alert.days_remaining == 5
    assert alert.alert_status == "active"
    assert alert.hospital_id == 10
    assert alert.medicine_id == 20
    db.add.assert_called_with(alert)


def test_sync_marks_active_expired_batch_as_expired():
    db = make_db(existing_alert=None)
    batch = make_batch(-2, status="active")
    alert = es.sync_batch_alert(db, batch)
    assert batch.status == "expired"
    assert alert.risk_level == "expired"


def test_sync_does_not_change_status_of_non_active_batch():
    db = make_db(existing_alert=None)
    batch = make_batch(-2, status="quarantined")
    es.sync_batch_alert(db, batch)
    assert batch.status == "quarantined"


def test_sync_updates_existing_alert():
    existing = SimpleNamespace(
        days_remaining=40, risk_level="medium", alert_status="active", updated_at=None
    )
    db = make_db(existing_alert=existing)
    result = es.sync_batch_alert(db, make_batch(20))
    assert result is existing
    assert existing.days_remaining == 20
    assert existing.risk_level == "high"
    assert existing.updated_at is not None


def test_sync_reactivates_resolved_alert_when_still_at_risk():
    existing = SimpleNamespace(
        days_remaining=100, risk_level="normal", alert_status="resolved", updated_at=None
    )
    db = make_db(existing_alert=existing)
    es.sync_batch_alert(db, make_batch(10))
    assert existing.alert_status == "active"


def test_sync_normal_batch_without_alert_returns_none():
    db = make_db(existing_alert=None)
    assert es.sync_batch_alert(db, make_batch(200)) is None
    db.add.assert_not_called()


def test_sync_resolves_active_alert_when_batch_becomes_normal():
    existing = SimpleNamespace(
        days_remaining=20, risk_level="high", alert_status="active", updated_at=None
    )
    db = make_db(existing_alert=existing)
    result = es.sync_batch_alert(db, make_batch(200))
    assert result is existing
    assert existing.alert_status == "resolved"
    assert existing.risk_level == "normal"


def test_refresh_all_alerts_counts_only_batches_with_alerts():
    db = MagicMock()
    db.query.return_value.all.return_value = [object(), object(), object()]
    with patch.object(es, "sync_batch_alert", side_effect=[object(), None, object()]):
        count = es.refresh_all_alerts(db)
    assert count == 2
    db.commit.assert_called_once()


def test_refresh_all_alerts_filters_by_hospital():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [object()]
    with patch.object(es, "sync_batch_alert", return_value=object()):
        count = es.refresh_all_alerts(db, hospital_id=10)
    assert count == 1
    db.query.return_value.filter.assert_called_once()
    db.commit.assert_called_once()
