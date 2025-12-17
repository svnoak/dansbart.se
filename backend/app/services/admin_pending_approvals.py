from sqlalchemy.orm import Session
from datetime import datetime
from app.core.models import PendingArtistApproval, ArtistCrawlLog
from .admin_query_helpers import build_paginated_response
from .admin_rejections import AdminRejectionService


class AdminPendingApprovalService:
    """Service for pending artist approval workflow."""

    def __init__(self, db: Session):
        self.db = db
        self.rejection_service = AdminRejectionService(db)

    def get_pending_artists_for_approval(
        self,
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        Get artists pending manual approval.

        Args:
            limit: Items per page
            offset: Pagination offset

        Returns:
            Paginated response with pending artist list
        """
        query = self.db.query(PendingArtistApproval).filter(
            PendingArtistApproval.status == 'pending'
        )

        total = query.count()
        artists = query.order_by(
            PendingArtistApproval.discovered_at.desc()
        ).offset(offset).limit(limit).all()

        items = []
        for artist in artists:
            items.append({
                "id": str(artist.id),
                "spotify_id": artist.spotify_id,
                "name": artist.name,
                "image_url": artist.image_url,
                "detected_genres": artist.detected_genres,
                "music_genre": artist.music_genre_classification,
                "genre_confidence": artist.genre_confidence,
                "discovered_at": artist.discovered_at.isoformat(),
                "discovery_source": artist.discovery_source
            })

        return build_paginated_response(items, total, limit, offset)

    def approve_pending_artist(self, artist_id: str) -> dict:
        """
        Approve a pending artist and ingest their discography.

        Args:
            artist_id: PendingArtistApproval ID

        Returns:
            Status dict with operation results
        """
        from app.workers.ingestion.spotify import SpotifyIngestor
        from app.workers.tasks import analyze_track_task
        from app.services.genre_classifier import GenreClassifier

        artist = self.db.query(PendingArtistApproval).filter(
            PendingArtistApproval.id == artist_id
        ).first()

        if not artist:
            raise ValueError("Pending artist not found")

        if artist.status != 'pending':
            raise ValueError(f"Artist already {artist.status}")

        # Mark as approved
        artist.status = 'approved'
        artist.reviewed_at = datetime.timezone.now()

        try:
            # Ingest the artist
            ingestor = SpotifyIngestor(self.db)
            track_ids = ingestor.ingest_artist_albums(artist.spotify_id)

            # Queue tracks for analysis
            if track_ids:
                for tid in track_ids:
                    analyze_track_task.delay(tid)

            # Log the crawl
            crawl_log = ArtistCrawlLog(
                spotify_artist_id=artist.spotify_id,
                artist_name=artist.name,
                tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
                status='success',
                detected_genres=artist.detected_genres or [],
                music_genre_classification=artist.music_genre_classification,
                discovery_source=f'manual_approval_from_{artist.discovery_source}'
            )
            self.db.add(crawl_log)

            # Update track genres
            genre_classifier = GenreClassifier(self.db)
            tracks_updated = genre_classifier.classify_all_tracks_for_artist(artist.spotify_id)

            self.db.flush()

            return {
                "status": "success",
                "message": f"Approved and ingested {artist.name}",
                "tracks_found": len(track_ids) if isinstance(track_ids, list) else track_ids,
                "tracks_tagged": tracks_updated
            }

        except Exception as e:
            self.db.rollback()
            artist.status = 'pending'  # Revert status on error
            self.db.commit()
            raise

    def reject_pending_artist(self, artist_id: str, reason: str) -> dict:
        """
        Reject a pending artist and add to blocklist.

        Args:
            artist_id: PendingArtistApproval ID
            reason: Reason for rejection

        Returns:
            Status dict with operation results
        """
        artist = self.db.query(PendingArtistApproval).filter(
            PendingArtistApproval.id == artist_id
        ).first()

        if not artist:
            raise ValueError("Pending artist not found")

        # Mark as rejected
        artist.status = 'rejected'
        artist.reviewed_at = datetime.utcnow()

        # Add to rejection blocklist
        self.rejection_service.add_to_blocklist(
            entity_type='artist',
            spotify_id=artist.spotify_id,
            name=artist.name,
            reason=reason or 'Not relevant',
            additional_data={
                'genres': artist.detected_genres,
                'classification': artist.music_genre_classification,
                'confidence': artist.genre_confidence
            }
        )

        self.db.flush()

        return {
            "status": "success",
            "message": f"Rejected {artist.name} and added to blocklist"
        }
