from datetime import date


def validate_batch_dates(manufacturing_date: date, expiry_date: date) -> None:
    if expiry_date <= manufacturing_date:
        raise ValueError("Expiry date must be after manufacturing date")