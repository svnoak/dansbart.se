from fastapi import APIRouter

# Import the specific routers from the files inside this folder
# Assuming you have files like tracks.py, artists.py inside app/api/admin/
from .admin_routes import router as admin_router
from .analytics_admin import router as analytics_admin
from .spotify_preview import router as spotify_preview_router
# ... import others ...

# Create one main router for the admin package
router = APIRouter()

# Include the sub-routers
router.include_router(admin_router)
router.include_router(analytics_admin)
router.include_router(spotify_preview_router, prefix="/spotify", tags=["Spotify Preview"])