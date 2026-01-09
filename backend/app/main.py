from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.public.routes import router
from app.api.admin import router as admin_router
from app.api.admin.analytics_admin import router as analytics_admin_router
from app.api.auth import routes as auth_routes
from app.api.playlists import routes as playlist_routes
import os

app = FastAPI(title="Dansbart API")

origins_str = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes
app.include_router(router, prefix="/api")

# Admin routes
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(analytics_admin_router, prefix="/api/admin/analytics", tags=["Analytics Admin"])

# Authentication & User routes
app.include_router(auth_routes.router, prefix="/api")
app.include_router(playlist_routes.router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "Dansgolvet är öppet 🎻"}