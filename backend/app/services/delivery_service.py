
import math
import logging
from typing import Tuple, Dict, Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.setting import ApplicationSetting
from app.models.hospital import Hospital

logger = logging.getLogger(__name__)


def validate_coordinates(lat: float, lon: float) -> None:
    """Validate latitude and longitude before routing."""
    if not math.isfinite(lat) or not math.isfinite(lon):
        raise ValueError("Coordinates must be finite numbers.")

    if not -90 <= lat <= 90:
        raise ValueError("Latitude must be between -90 and 90.")

    if not -180 <= lon <= 180:
        raise ValueError("Longitude must be between -180 and 180.")


def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Calculate great-circle distance between two points in kilometers."""
    R = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2.0) ** 2
    )
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(R * c, 2)


def get_delivery_rates(
    db: Optional[Session] = None,
) -> Tuple[float, float]:
    """Fetch delivery rates from settings or use system defaults."""
    cost_per_km = float(settings.DEFAULT_DELIVERY_COST_PER_KM)
    fixed_charge = float(settings.DEFAULT_FIXED_DELIVERY_CHARGE)

    if db is not None:
        try:
            rate_setting = (
                db.query(ApplicationSetting)
                .filter(ApplicationSetting.key == "cost_per_km")
                .first()
            )
            if rate_setting:
                cost_per_km = float(rate_setting.value)

            fixed_setting = (
                db.query(ApplicationSetting)
                .filter(
                    ApplicationSetting.key == "fixed_delivery_charge"
                )
                .first()
            )
            if fixed_setting:
                fixed_charge = float(fixed_setting.value)

        except Exception as e:
            logger.warning(
                "Error loading delivery rates from database: %s", e
            )

    if (
        not math.isfinite(cost_per_km)
        or not math.isfinite(fixed_charge)
        or cost_per_km < 0
        or fixed_charge < 0
    ):
        logger.warning("Invalid delivery rates; using system defaults.")
        cost_per_km = float(settings.DEFAULT_DELIVERY_COST_PER_KM)
        fixed_charge = float(settings.DEFAULT_FIXED_DELIVERY_CHARGE)

    return cost_per_km, fixed_charge


def calculate_delivery_cost(
    distance_km: float,
    cost_per_km: float,
    fixed_charge: float,
) -> float:
    """Calculate total delivery cost."""
    if (
        not math.isfinite(distance_km)
        or not math.isfinite(cost_per_km)
        or not math.isfinite(fixed_charge)
        or distance_km < 0
        or cost_per_km < 0
        or fixed_charge < 0
    ):
        raise ValueError("Distance and delivery rates must be finite and non-negative.")

    return round(fixed_charge + distance_km * cost_per_km, 2)


def _same_coordinates(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> bool:
    return round(lat1, 5) == round(lat2, 5) and round(lon1, 5) == round(lon2, 5)


def _zero_distance_result(
    cost_per_km: float,
) -> Dict[str, Any]:
    return {
        "distance_km": 0.0,
        "duration_hours": 0.0,
        "is_road_distance": True,
        "cost_per_km": cost_per_km,
        "fixed_charge": 0.0,
        "estimated_cost": 0.0,
        "geometry": [],
    }


def calculate_route_sync(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Calculate route metrics synchronously, falling back to Haversine."""
    validate_coordinates(lat1, lon1)
    validate_coordinates(lat2, lon2)

    cost_per_km, fixed_charge = get_delivery_rates(db)

    if _same_coordinates(lat1, lon1, lat2, lon2):
        return _zero_distance_result(cost_per_km)

    osrm_url = (
        f"{settings.OSRM_ROUTING_URL}/route/v1/driving/"
        f"{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    )

    try:
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(osrm_url)
            resp.raise_for_status()
            data = resp.json()

        routes = data.get("routes", [])
        if data.get("code") == "Ok" and routes:
            route = routes[0]
            distance_km = round(float(route["distance"]) / 1000.0, 2)
            duration_hours = round(float(route["duration"]) / 3600.0, 2)

            if (
                math.isfinite(distance_km)
                and math.isfinite(duration_hours)
                and distance_km >= 0
                and duration_hours >= 0
            ):
                geometry = (
                    route.get("geometry", {}).get("coordinates", [])
                )
                return {
                    "distance_km": distance_km,
                    "duration_hours": duration_hours,
                    "is_road_distance": True,
                    "cost_per_km": cost_per_km,
                    "fixed_charge": fixed_charge,
                    "estimated_cost": calculate_delivery_cost(
                        distance_km, cost_per_km, fixed_charge
                    ),
                    "geometry": geometry,
                }

    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        logger.debug(
            "Sync OSRM routing failed; falling back to Haversine: %s", e
        )

    direct_km = haversine_distance(lat1, lon1, lat2, lon2)
    duration_hours = round(direct_km / 45.0, 2)

    return {
        "distance_km": direct_km,
        "duration_hours": duration_hours,
        "is_road_distance": False,
        "cost_per_km": cost_per_km,
        "fixed_charge": fixed_charge,
        "estimated_cost": calculate_delivery_cost(
            direct_km, cost_per_km, fixed_charge
        ),
        "geometry": [[lon1, lat1], [lon2, lat2]],
    }


async def calculate_route_async(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Calculate route metrics asynchronously, falling back to Haversine."""
    validate_coordinates(lat1, lon1)
    validate_coordinates(lat2, lon2)

    cost_per_km, fixed_charge = get_delivery_rates(db)

    if _same_coordinates(lat1, lon1, lat2, lon2):
        return _zero_distance_result(cost_per_km)

    osrm_url = (
        f"{settings.OSRM_ROUTING_URL}/route/v1/driving/"
        f"{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    )

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(osrm_url)
            resp.raise_for_status()
            data = resp.json()

        routes = data.get("routes", [])
        if data.get("code") == "Ok" and routes:
            route = routes[0]
            distance_km = round(float(route["distance"]) / 1000.0, 2)
            duration_hours = round(float(route["duration"]) / 3600.0, 2)

            if (
                math.isfinite(distance_km)
                and math.isfinite(duration_hours)
                and distance_km >= 0
                and duration_hours >= 0
            ):
                geometry = (
                    route.get("geometry", {}).get("coordinates", [])
                )
                return {
                    "distance_km": distance_km,
                    "duration_hours": duration_hours,
                    "is_road_distance": True,
                    "cost_per_km": cost_per_km,
                    "fixed_charge": fixed_charge,
                    "estimated_cost": calculate_delivery_cost(
                        distance_km, cost_per_km, fixed_charge
                    ),
                    "geometry": geometry,
                }

    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        logger.info(
            "Async OSRM routing failed; falling back to Haversine: %s", e
        )

    direct_km = haversine_distance(lat1, lon1, lat2, lon2)
    duration_hours = round(direct_km / 45.0, 2)

    return {
        "distance_km": direct_km,
        "duration_hours": duration_hours,
        "is_road_distance": False,
        "cost_per_km": cost_per_km,
        "fixed_charge": fixed_charge,
        "estimated_cost": calculate_delivery_cost(
            direct_km, cost_per_km, fixed_charge
        ),
        "geometry": [[lon1, lat1], [lon2, lat2]],
    }


def calculate_hospitals_delivery(
    source_hospital: Hospital,
    dest_hospital: Hospital,
    db: Session,
) -> Dict[str, Any]:
    """Calculate delivery metrics between two hospital entities."""
    return calculate_route_sync(
        source_hospital.latitude,
        source_hospital.longitude,
        dest_hospital.latitude,
        dest_hospital.longitude,
        db=db,
    )
