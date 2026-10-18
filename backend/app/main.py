from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.services.expiry_service import refresh_all_alerts

# Import all routers
from app.routers import (
    auth_router,
    hospitals_router,
    staff_router,
    medicines_router,
    batches_router,
    alerts_router,
    rescue_router,
    transfers_router,
    map_routes_router,
    delivery_router,
    dashboard_router,
    analytics_router,
    assistant_router,
    settings_router,
    audit_router,
    demands_router,
    inventory_movements_router,
    forecasts_router,
    payments_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager:
    - Creates database schemas if not already created
    - Seeds idempotent demonstration data on initial startup
    - Recalculates real-time expiry risk levels and alerts
    """
    # 1. Initialize tables safely
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[Lifespan Error] Base.metadata.create_all failed: {e}")

    # 2. Seed default demo data idempotently
    try:
        db = SessionLocal()
        try:
            seed_database(db)
            refresh_all_alerts(db)
        finally:
            db.close()
    except Exception as e:
        print(f"[Lifespan Error] Database seed/alert refresh failed: {e}")

    yield
    # Cleanup on shutdown (if any)


app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent Inter-Hospital Medicine Redistribution & Expiry Prevention Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Configure CORS
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [o.strip() for o in origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[Unhandled Server Exception] {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact system administration."},
    )


# Health Check & Root Endpoints
@app.get("/", tags=["Health"])
def root_endpoint():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "operational",
        "documentation": "/api/docs",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/health", tags=["Health"])
def health_check():
    """Verify backend and database connectivity."""
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        print(f"Health check db error: {e}")
    finally:
        db.close()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "environment": settings.APP_ENV,
        "timestamp": datetime.utcnow().isoformat(),
    }


# Include all routers
app.include_router(auth_router)
app.include_router(hospitals_router)
app.include_router(staff_router)
app.include_router(medicines_router)
app.include_router(batches_router)
app.include_router(alerts_router)
app.include_router(rescue_router)
app.include_router(transfers_router)
app.include_router(map_routes_router)
app.include_router(delivery_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(assistant_router)
app.include_router(settings_router)
app.include_router(audit_router)
app.include_router(demands_router)
app.include_router(inventory_movements_router)
app.include_router(forecasts_router)
app.include_router(payments_router)
