from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.analysis import AnalysisService

# GLOBAL VARIABLE (Per Worker Process)
# This starts as None. The first task this worker runs will fill it.
# Subsequent tasks on the same worker will reuse it.
_worker_analysis_service = None

def get_analysis_service():
    global _worker_analysis_service
    if _worker_analysis_service is None:
        print("🔧 WORKER INIT: Loading TensorFlow/Essentia models for this process...")
        # This triggers the heavy load INSIDE the correct process
        _worker_analysis_service = AnalysisService(None)
    return _worker_analysis_service

@celery_app.task(acks_late=True)
def analyze_track_task(track_id: str):
    print(f"🏋️‍♂️ WORKER: Starting analysis for {track_id}")
    
    # 1. Get the service (Loads model if first run)
    service = get_analysis_service()
    
    # 2. Create a fresh DB session
    db = SessionLocal()
    try:
        # 3. Inject the fresh session into the reused service
        service.db = db
        
        # 4. Run Logic
        service.analyze_track_by_id(track_id)
        
        print(f"✅ WORKER: Finished {track_id}")
    except Exception as e:
        db.rollback()
        print(f"❌ WORKER FAILED: {e}")
    finally:
        db.close()