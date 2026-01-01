"""API routes"""
from backend.routes.dashboard import router as dashboard_router
from backend.routes.scan_intelx import router as scan_intelx_router
from backend.routes.scan_file import router as scan_file_router
from backend.routes.jobs import router as jobs_router
from backend.routes.results import router as results_router
from backend.routes.settings import router as settings_router
from backend.routes.organizations import router as organizations_router
from backend.routes.scheduler import router as scheduler_router
from backend.routes.auth import router as auth_router

__all__ = [
    'dashboard_router',
    'scan_intelx_router',
    'scan_file_router',
    'jobs_router',
    'results_router',
    'organizations_router',
    'settings_router',
    'scheduler_router',
    'auth_router'
]