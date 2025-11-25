from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(title="Dansbart API")

# Allow frontend (localhost:3000) to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "Dansgolvet är öppet 🎻"}