from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.pipeline import PipelineService
from pydantic import BaseModel

router = APIRouter()

# Simple security
ADMIN_SECRET = "my-super-secret-password-123" # Move to .env later

class IngestRequest(BaseModel):
    playlist_id: str

@router.post("/ingest")
def trigger_ingest(
    req: IngestRequest, 
    background_tasks: BackgroundTasks,
    x_admin_token: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Not authorized")

    pipeline = PipelineService(db)
    return pipeline.ingest_and_process_playlist(req.playlist_id, background_tasks)