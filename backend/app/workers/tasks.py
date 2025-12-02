# app/workers/tasks.py
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.analysis import AnalysisService

# This function runs on the 'worker' container, NOT the 'backend' container
@celery_app.task(acks_late=True)
def analyze_track_task(track_id: str):
    print(f"🏋️‍♂️ WORKER: Starting heavy analysis for {track_id}")
    
    db = SessionLocal()
    try:
        service = AnalysisService(db)
        service.analyze_track_by_id(track_id)
        print(f"✅ WORKER: Finished {track_id}")
    except Exception as e:
        print(f"❌ WORKER FAILED: {e}")
    finally:
        db.close()