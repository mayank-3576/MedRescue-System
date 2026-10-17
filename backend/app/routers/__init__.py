from app.routers.auth import router as auth_router
from app.routers.hospitals import router as hospitals_router
from app.routers.staff import router as staff_router
from app.routers.medicines import router as medicines_router
from app.routers.batches import router as batches_router
from app.routers.alerts import router as alerts_router
from app.routers.rescue import router as rescue_router
from app.routers.transfers import router as transfers_router
from app.routers.map_routes import router as map_routes_router
from app.routers.delivery import router as delivery_router
from app.routers.dashboard import router as dashboard_router
from app.routers.analytics import router as analytics_router
from app.routers.assistant import router as assistant_router
from app.routers.settings import router as settings_router
from app.routers.audit import router as audit_router
from app.routers.demands import router as demands_router
from app.routers.inventory_movements import router as inventory_movements_router
from app.routers.forecasts import router as forecasts_router
from app.routers.payments import router as payments_router

__all__ = [
    "auth_router",
    "hospitals_router",
    "staff_router",
    "medicines_router",
    "batches_router",
    "alerts_router",
    "rescue_router",
    "transfers_router",
    "map_routes_router",
    "delivery_router",
    "dashboard_router",
    "analytics_router",
    "assistant_router",
    "settings_router",
    "audit_router",
    "demands_router",
    "inventory_movements_router",
    "forecasts_router",
    "payments_router",
]
