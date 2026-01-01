"""FastAPI application entrypoint for IntelX Scanner Web UI"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db
from backend.services.scheduler_service import get_scheduler_service
from backend.routes import (
    dashboard_router,
    scan_intelx_router,
    scan_file_router,
    jobs_router,
    results_router,
    settings_router,
    organizations_router,
    scheduler_router,
    auth_router
)
from backend.routes.pages import router as pages_router
from backend.routes.credentials import router as credentials_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION
)

# CORS (open by default; tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Initialize database and start APScheduler service on startup"""
    init_db()
    # Start scheduler service (idempotent), load active jobs, and register cron triggers
    try:
        svc = get_scheduler_service()
        svc.start()
    except Exception:
        # Avoid crashing app on scheduler init; can be inspected via logs
        pass


# Health check
@app.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}


# Root
@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "endpoints": [
            "/dashboard",
            "/api/dashboard/stats",
            "/api/dashboard/top-domains",
            "/api/dashboard/recent-scans",
            "/api/scan/intelx/single",
            "/api/scan/intelx/multiple",
            "/api/scan/intelx/multiple-file",
            "/api/scan/file/",
            "/api/jobs/",
            "/api/jobs/{job_id}",
            "/api/organizations",
            "/api/organizations/{domain}"
        ]
    }


# Routers
app.include_router(auth_router)
app.include_router(pages_router)
app.include_router(dashboard_router)
app.include_router(scan_intelx_router)
app.include_router(scan_file_router)
app.include_router(jobs_router)
app.include_router(results_router)
app.include_router(settings_router)
app.include_router(credentials_router)
app.include_router(organizations_router)
app.include_router(scheduler_router)