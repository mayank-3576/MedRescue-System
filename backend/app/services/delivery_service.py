import math
import logging
from typing import Tuple, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.setting import ApplicationSetting
from app.models.hospital import Hospital

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth in kilometers.
    """
    R = 6371.0  # Earth's radius in kilometers

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    distance = R * c
    return round(distance, 2)


def get_delivery_rates(db: Optional[Session] = None) -> Tuple[float, float]:
    """
    Fetch cost_per_km and fixed_charge from application settings, or use system defaults.
    """
    cost_per_km = settings.DEFAULT_DELIVERY_COST_PER_KM
    fixed_charge = settings.DEFAULT_FIXED_DELIVERY_CHARGE

    if db is not None:
        try:
            rate_setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "cost_per_km").first()
            if rate_setting:
                cost_per_km = float(rate_setting.value)
            
            fixed_setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "fixed_delivery_charge").first()
            if fixed_setting:
                fixed_charge = float(fixed_setting.value)
        except Exception as e:
            logger.warning(f"Error loading delivery rates from database: {e}")

    return cost_per_km, fixed_charge


def calculate_delivery_cost(distance_km: float, cost_per_km: float, fixed_charge: float) -> float:
    """
    Calculate total delivery cost given distance, rate per km, and fixed base charge.
    """
    total = fixed_charge + (distance_km * cost_per_km)
    return round(total, 2)


async def calculate_route_async(
    lat1: float, lon1: float, lat2: float, lon2: float, db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Calculate route distance and delivery cost using OSRM routing with fallback to Haversine.
    """
    cost_per_km, fixed_charge = get_delivery_rates(db)
    
    # Check if identical coordinates
    if round(lat1, 5) == round(lat2, 5) and round(lon1, 5) == round(lon2, 5):
        return {
            "distance_km": 0.0,
            "duration_hours": 0.0,
            "is_road_distance": True,
            "cost_per_km": cost_per_km,
            "fixed_charge": 0.0,
            "estimated_cost": 0.0,
            "geometry": [],
        }

    # Attempt OSRM road distance lookup
    osrm_url = f"{settings.OSRM_ROUTING_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=simplified&geometries=geojson"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(osrm_url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and len(data.get("routes", [])) > 0:
                    route = data["routes"][0]
                    distance_km = round(route["distance"] / 1000.0, 2)
                    duration_hours = round(route["duration"] / 3600.0, 2)
                    geometry = route.get("geometry", {}).get("coordinates", [])
                    cost = calculate_delivery_cost(distance_km, cost_per_km, fixed_charge)
                    return {
                        "distance_km": distance_km,
                        "duration_hours": duration_hours,
                        "is_road_distance": True,
                        "cost_per_km": cost_per_km,
                        "fixed_charge": fixed_charge,
                        "estimated_cost": cost,
                        "geometry": geometry,
                    }
    except Exception as e:
        logger.info(f"OSRM routing failed or timed out ({e}). Falling back to Haversine calculation.")

    # Transparent fallback: use direct geodesic distance and do not claim a road route.
    direct_km = haversine_distance(lat1, lon1, lat2, lon2)
    duration_hours = round(direct_km / 45.0, 2)
    cost = calculate_delivery_cost(direct_km, cost_per_km, fixed_charge)

    return {
        "distance_km": direct_km,
        "duration_hours": duration_hours,
        "is_road_distance": False,
        "cost_per_km": cost_per_km,
        "fixed_charge": fixed_charge,
        "estimated_cost": cost,
        "geometry": [[lon1, lat1], [lon2, lat2]],
    }


def calculate_route_sync(
    lat1: float, lon1: float, lat2: float, lon2: float, db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Synchronous route calculation with fallback to Haversine.
    """
    cost_per_km, fixed_charge = get_delivery_rates(db)

    if round(lat1, 5) == round(lat2, 5) and round(lon1, 5) == round(lon2, 5):
        return {
            "distance_km": 0.0,
            "duration_hours": 0.0,
            "is_road_distance": True,
            "cost_per_km": cost_per_km,
            "fixed_charge": 0.0,
            "estimated_cost": 0.0,
        }

    osrm_url = f"{settings.OSRM_ROUTING_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
    try:
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(osrm_url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and len(data.get("routes", [])) > 0:
                    route = data["routes"][0]
                    distance_km = round(route["distance"] / 1000.0, 2)
                    duration_hours = round(route["duration"] / 3600.0, 2)
                    cost = calculate_delivery_cost(distance_km, cost_per_km, fixed_charge)
                    return {
                        "distance_km": distance_km,
                        "duration_hours": duration_hours,
                        "is_road_distance": True,
                        "cost_per_km": cost_per_km,
                        "fixed_charge": fixed_charge,
                        "estimated_cost": cost,
                    }
    except Exception as e:
        logger.debug(f"Sync OSRM route fetch failed ({e}); falling back to Haversine.")

    direct_km = haversine_distance(lat1, lon1, lat2, lon2)
    duration_hours = round(direct_km / 45.0, 2)
    cost = calculate_delivery_cost(direct_km, cost_per_km, fixed_charge)

    return {
        "distance_km": direct_km,
        "duration_hours": duration_hours,
        "is_road_distance": False,
        "cost_per_km": cost_per_km,
        "fixed_charge": fixed_charge,
        "estimated_cost": cost,
    }


def calculate_hospitals_delivery(
    source_hospital: Hospital, dest_hospital: Hospital, db: Session
) -> Dict[str, Any]:
    """Calculate delivery metrics between two hospital entities."""
    return calculate_route_sync(
        source_hospital.latitude,
        source_hospital.longitude,
        dest_hospital.latitude,
        dest_hospital.longitude,
        db=db
    )
