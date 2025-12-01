from sqlalchemy.orm import Session
from app.core.models import PlaybackLink

class LinkService:
    def __init__(self, db: Session):
        self.db = db

    def report_broken(self, link_id: str, reason: str) -> bool:
        """
        Flags a link as broken.
        Returns True if successful, False if link not found.
        """
        link = self.db.query(PlaybackLink).filter(PlaybackLink.id == link_id).first()
        
        if not link:
            return False
        
        # Disable the link so it stops showing up in the app
        link.is_working = False
        
        # (Future: You could save the 'reason' to a separate LinkFeedback table here)
        
        self.db.commit()
        
        # Logging for Docker output
        print(f"🔗 Link {link_id} reported broken. Reason: {reason}")
        
        return True