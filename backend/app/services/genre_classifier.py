"""
Genre Classification Service

Classifies tracks into music genres (traditional_folk, modern_folk, folk_pop, contemporary)
This is SEPARATE from dance style classification (Hambo, Polska, etc.)

Uses multiple signals:
1. Spotify artist genres
2. Release year (older = more traditional)
3. Artist name patterns (spelmanslag, etc.)
4. Audio analysis features (acoustic vs electronic)
"""

from sqlalchemy.orm import Session
from app.core.models import Track, Artist, ArtistCrawlLog
from typing import Optional, Tuple
import re


class GenreClassifier:
    """
    Classifies music genre (traditional vs modern folk vs pop)
    """

    # Traditional folk indicators
    TRADITIONAL_KEYWORDS = [
        'spelmanslag', 'folkmusikgrupp', 'nyckelharpa', 'fiddlers',
        'folkmusikensemble', 'riksspelman', 'spelman'
    ]

    TRADITIONAL_GENRES = [
        'swedish folk', 'nordic folk', 'scandinavian folk',
        'spelmanslag', 'folkmusik', 'polska', 'svensk folkmusik',
        'traditional folk', 'fiddle', 'nordic fiddle'
    ]

    # Modern/pop indicators
    MODERN_GENRES = [
        'folk pop', 'indie folk', 'chamber pop', 'folktronica',
        'neo-folk', 'progressive folk', 'folk rock'
    ]

    CONTEMPORARY_GENRES = [
        'pop', 'rock', 'indie', 'alternative', 'electronic',
        'dance', 'edm', 'house', 'dansband'
    ]

    def __init__(self, db: Session):
        self.db = db

    def classify_artist_genre(
        self,
        artist_name: str,
        spotify_genres: list[str],
        release_year: Optional[int] = None
    ) -> Tuple[str, float]:
        """
        Classify an artist's music genre.

        Returns:
            Tuple of (genre, confidence)
            genre: 'traditional_folk', 'modern_folk', 'folk_pop', 'contemporary', 'unknown'
            confidence: 0.0 to 1.0
        """

        confidence_scores = {
            'traditional_folk': 0.0,
            'modern_folk': 0.0,
            'folk_pop': 0.0,
            'contemporary': 0.0
        }

        # Signal 1: Artist Name Pattern Analysis
        name_lower = artist_name.lower()
        for keyword in self.TRADITIONAL_KEYWORDS:
            if keyword in name_lower:
                confidence_scores['traditional_folk'] += 0.3
                break

        # Signal 2: Spotify Genre Tags
        for genre in spotify_genres:
            genre_lower = genre.lower()

            # Check traditional markers
            if any(trad in genre_lower for trad in self.TRADITIONAL_GENRES):
                confidence_scores['traditional_folk'] += 0.4

            # Check modern folk markers
            elif any(modern in genre_lower for modern in self.MODERN_GENRES):
                confidence_scores['modern_folk'] += 0.4

            # Check contemporary/pop markers
            elif any(contemp in genre_lower for contemp in self.CONTEMPORARY_GENRES):
                confidence_scores['contemporary'] += 0.3

            # Generic "folk" without qualifiers -> lean modern
            elif 'folk' in genre_lower and len(genre_lower) < 15:
                confidence_scores['modern_folk'] += 0.2

        # Signal 3: Release Year (if provided)
        if release_year:
            if release_year < 1990:
                confidence_scores['traditional_folk'] += 0.2
            elif release_year < 2005:
                confidence_scores['modern_folk'] += 0.15
            else:
                confidence_scores['folk_pop'] += 0.1

        # Signal 4: If has any folk genre but also contemporary genres -> folk_pop
        has_folk = any('folk' in g.lower() for g in spotify_genres)
        has_pop = any(g.lower() in ['pop', 'indie', 'alternative'] for g in spotify_genres)
        if has_folk and has_pop:
            confidence_scores['folk_pop'] += 0.3

        # Determine winner
        max_genre = max(confidence_scores, key=confidence_scores.get)
        max_confidence = confidence_scores[max_genre]

        # Normalize confidence to 0-1 range (max possible is ~1.0)
        max_confidence = min(max_confidence, 1.0)

        # If no strong signal, return unknown
        if max_confidence < 0.2:
            return 'unknown', 0.0

        return max_genre, max_confidence

    def classify_track_from_artist(self, track: Track) -> Tuple[str, float]:
        """
        Classify a track's genre based on its artist's information.
        """

        # Get primary artist
        if not track.artist_links:
            return 'unknown', 0.0

        primary_artist = track.primary_artist
        if not primary_artist:
            return 'unknown', 0.0

        # Get artist's Spotify info if available
        spotify_id = primary_artist.spotify_id
        if not spotify_id:
            return 'unknown', 0.0

        # Check if we have crawl log data
        crawl_log = self.db.query(ArtistCrawlLog).filter(
            ArtistCrawlLog.spotify_artist_id == spotify_id
        ).first()

        if crawl_log and crawl_log.music_genre_classification:
            # Use cached classification
            return crawl_log.music_genre_classification, 0.8

        # Otherwise, fetch from Spotify (requires SpotifyIngestor)
        # For now, classify based on artist name only
        return self.classify_artist_genre(
            primary_artist.name,
            [],
            self._extract_release_year(track.album.release_date) if track.album else None
        )

    def classify_all_tracks_for_artist(self, artist_id: str) -> int:
        """
        Classify all tracks for a given artist based on their genre classification.
        Returns count of tracks updated.
        """

        # Get artist's genre classification from crawl log
        crawl_log = self.db.query(ArtistCrawlLog).filter(
            ArtistCrawlLog.spotify_artist_id == artist_id
        ).first()

        if not crawl_log or not crawl_log.music_genre_classification:
            return 0

        # Find artist in DB
        artist = self.db.query(Artist).filter(Artist.spotify_id == artist_id).first()
        if not artist:
            return 0

        # Update all tracks by this artist
        count = 0
        for link in artist.track_links:
            track = link.track
            if not track.music_genre:  # Only update if not already set
                track.music_genre = crawl_log.music_genre_classification
                track.genre_confidence = 0.8
                count += 1

        self.db.commit()
        return count

    def _extract_release_year(self, release_date: str) -> Optional[int]:
        """Extract year from release date string (format: YYYY or YYYY-MM-DD)"""
        if not release_date:
            return None
        try:
            return int(release_date[:4])
        except (ValueError, TypeError):
            return None

    # Nordic/Swedish indicators for stricter filtering
    NORDIC_KEYWORDS = [
        'swedish', 'nordic', 'scandinavian', 'sverige', 'svensk',
        'norwegian', 'norsk', 'denmark', 'dansk', 'finland', 'suomi',
        'iceland', 'icelandic'
    ]

    def is_folk_artist(self, spotify_genres: list[str], artist_name: str) -> bool:
        """
        Strict check if an artist is Swedish/Nordic folk music.

        Accepts:
        - Artists with Nordic/Swedish folk genres
        - Artists with traditional folk keywords in name (spelmanslag, etc.)
        - Artists with Nordic+folk combination

        Rejects:
        - Generic "folk" without Nordic/Swedish markers
        - Folk from other regions (Irish folk, American folk, etc.)
        - Folk-adjacent genres (indie folk, folk pop, folk rock) without Nordic markers
        """

        # Check name for traditional Swedish/Nordic folk indicators
        name_lower = artist_name.lower()
        if any(kw in name_lower for kw in self.TRADITIONAL_KEYWORDS):
            return True

        # Check genres with strict filtering
        has_folk_genre = False
        has_nordic_marker = False
        has_traditional_folk = False

        for genre in spotify_genres:
            genre_lower = genre.lower()

            # Direct match: Traditional Nordic/Swedish folk genres
            if any(trad in genre_lower for trad in self.TRADITIONAL_GENRES):
                return True

            # Check for Nordic markers
            if any(nordic in genre_lower for nordic in self.NORDIC_KEYWORDS):
                has_nordic_marker = True

            # Check for folk-related terms
            if 'folk' in genre_lower or 'polska' in genre_lower or 'spelmanslag' in genre_lower:
                has_folk_genre = True

            # Reject folk-adjacent genres that are too pop/modern
            if any(x in genre_lower for x in ['indie folk', 'folk pop', 'folk rock',
                                               'alt-folk', 'anti-folk', 'freak folk',
                                               'stomp and holler', 'folk punk']):
                # Only accept these if they have Nordic markers
                if not has_nordic_marker:
                    continue

        # Accept if both folk AND nordic markers present
        if has_folk_genre and has_nordic_marker:
            return True

        return False
