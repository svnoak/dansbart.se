import random
import time
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.workers.ingestion.spotify import SpotifyIngestor
from app.repository.track import TrackRepository
from app.core.models import Track, ArtistCrawlLog, RejectionLog, PendingArtistApproval
from app.services.genre_classifier import GenreClassifier


class DiscoverySpider:
    """
    Enhanced Discovery Spider with:
    - Genre classification
    - Crawl tracking (no duplicate crawls)
    - Multi-signal folk detection
    - Statistics tracking
    """

    def __init__(self, db: Session):
        self.db = db
        self.ingestor = SpotifyIngestor(db)
        self.repo = TrackRepository(db)
        self.genre_classifier = GenreClassifier(db)
        # Reuse the Spotify client from the ingestor to share connection/auth
        self.sp = self.ingestor.sp

        # Statistics
        self.stats = {
            'artists_evaluated': 0,
            'artists_passed_gatekeeper': 0,
            'artists_already_crawled': 0,
            'artists_rejected': 0,
            'artists_crawled': 0,
            'tracks_found': 0
        }

    def crawl_related_artists(self, seed_limit=5, max_discoveries=10):
        """
        DISABLED: Related artists crawl tends to drift away from Swedish/Nordic folk.

        This method would:
        1. Pick random artists from our DB as seeds.
        2. Ask Spotify for 'Related Artists'.
        3. Filter for Folk genres using GenreClassifier.
        4. Check if already crawled (ArtistCrawlLog).
        5. Ingest their FULL discography with genre classification.

        Use crawl_by_search() or backfill_existing_artists() instead for better control.
        """
        print("⚠️  Related Artists Crawl is DISABLED")
        print("   This method tends to drift away from Swedish/Nordic folk music.")
        print("   Use crawl_by_search() or backfill_existing_artists() instead.")
        print("")
        print("   Recommended:")
        print("   - spider.backfill_existing_artists() - Complete discographies of existing artists")
        print("   - spider.crawl_by_search() - Discover new Swedish folk artists via search")

        return self.stats

    def crawl_by_search(self, max_discoveries=10):
        """
        Alternative crawl method: Search Spotify directly for folk artists/albums.
        Does not require seeds from the database.

        This method searches for folk-related keywords and ingests discovered artists.
        """
        print("🔍  Spider using Search Mode...")
        print(f"   Max discoveries: {max_discoveries}")

        # Folk-related search queries
        search_queries = [
            "Swedish folk music",
            "spelmanslag",
            "folkmusik",
            "nyckelharpa",
            "polska music",
            "nordic folk",
            "scandinavian folk",
            "svensk folkmusik",
            "riksspelman",
            "traditional folk sweden"
        ]

        discovered_count = 0

        for query in search_queries:
            if discovered_count >= max_discoveries:
                print(f"✅ Reached max discoveries limit ({max_discoveries})")
                break

            print(f"\n🔎 Searching: '{query}'")

            try:
                # Search for artists
                results = self.sp.search(q=query, type='artist', limit=20)

                if not results.get('artists', {}).get('items'):
                    print(f"   No results for '{query}'")
                    continue

                for artist in results['artists']['items']:
                    if discovered_count >= max_discoveries:
                        break

                    if self._evaluate_and_ingest(artist):
                        discovered_count += 1

            except Exception as e:
                print(f"⚠️  Search error for '{query}': {e}")

        # Print final statistics
        print("\n" + "="*60)
        print("🔍  Search Spider Session Complete")
        print("="*60)
        print(f"Artists Evaluated:         {self.stats['artists_evaluated']}")
        print(f"Rejected (Blocklisted):    {self.stats['artists_rejected']}")
        print(f"Passed Gatekeeper:         {self.stats['artists_passed_gatekeeper']}")
        print(f"Already Crawled (Skipped): {self.stats['artists_already_crawled']}")
        print(f"New Artists Crawled:       {self.stats['artists_crawled']}")
        print(f"Total Tracks Found:        {self.stats['tracks_found']}")
        print("="*60)

        return self.stats

    def backfill_existing_artists(self, max_artists=20, discover_from_albums=True):
        """
        Backfill method: Find all artists we have tracks for and ingest their complete discographies.
        This ensures we have ALL albums and tracks from artists already in our library.

        Args:
            max_artists: Maximum number of artists to backfill
            discover_from_albums: If True, also discover new artists from compilation/collaborative albums
        """
        print("🔄  Spider using Backfill Mode...")
        print(f"   Max artists to backfill: {max_artists}")
        print(f"   Discover from albums: {'Yes' if discover_from_albums else 'No'}")

        from app.core.models import Artist

        # Get all artists in our database that have a Spotify ID
        artists = self.db.query(Artist).filter(
            Artist.spotify_id.isnot(None)
        ).limit(max_artists * 2).all()  # Get more than needed to account for already-crawled

        if not artists:
            print("❌ No artists found in database with Spotify IDs!")
            return self.stats

        print(f"   Found {len(artists)} artists in database")

        backfilled_count = 0

        for artist in artists:
            if backfilled_count >= max_artists:
                print(f"✅ Reached max backfill limit ({max_artists})")
                break

            artist_id = artist.spotify_id
            artist_name = artist.name

            # Check if already crawled
            existing_log = self.db.query(ArtistCrawlLog).filter(
                ArtistCrawlLog.spotify_artist_id == artist_id
            ).first()

            if existing_log:
                self.stats['artists_already_crawled'] += 1
                print(f"   ⏭️  Skipping {artist_name} (already crawled on {existing_log.crawled_at.date()})")
                continue

            print(f"\n   🔄 Backfilling: {artist_name}")

            try:
                # Get artist details from Spotify for genre info
                sp_artist = self.sp.artist(artist_id)
                genres = sp_artist.get('genres', [])

                # Classify the artist's genre
                music_genre, confidence = self.genre_classifier.classify_artist_genre(
                    artist_name, genres, None
                )

                print(f"      Genre: {music_genre} ({confidence:.2f} confidence)")
                print(f"      Spotify genres: {genres}")

                # Ingest full discography
                track_ids = self.ingestor.ingest_artist_albums(artist_id)

                # Queue tracks for analysis
                if track_ids:
                    print(f"      ⚙️  Scheduling {len(track_ids)} tracks for analysis...")
                    # Lazy import to avoid loading heavy ML dependencies
                    from app.workers.tasks import analyze_track_task
                    for tid in track_ids:
                        analyze_track_task.delay(tid)

                # Log the backfill
                crawl_log = ArtistCrawlLog(
                    spotify_artist_id=artist_id,
                    artist_name=artist_name,
                    tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
                    status='success',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    discovery_source='backfill'
                )

                self.db.add(crawl_log)
                self.db.commit()

                # Update track genres for this artist
                tracks_updated = self.genre_classifier.classify_all_tracks_for_artist(artist_id)
                if tracks_updated > 0:
                    print(f"      🏷️  Tagged {tracks_updated} tracks as '{music_genre}'")

                self.stats['artists_crawled'] += 1
                self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids
                backfilled_count += 1

            except Exception as e:
                print(f"      ❌ Error backfilling {artist_name}: {e}")

                # Log the failure
                try:
                    crawl_log = ArtistCrawlLog(
                        spotify_artist_id=artist_id,
                        artist_name=artist_name,
                        tracks_found=0,
                        status='failed',
                        detected_genres=[],
                        music_genre_classification='unknown',
                        discovery_source='backfill'
                    )
                    self.db.add(crawl_log)
                    self.db.commit()
                except:
                    self.db.rollback()

        # PHASE 2: Discover new artists from albums (if enabled)
        discovered_from_albums = 0
        if discover_from_albums:
            print("\n" + "="*60)
            print("📀 Phase 2: Discovering Artists from Albums")
            print("="*60)
            discovered_from_albums = self._discover_artists_from_albums(max_artists - backfilled_count)
            print(f"   Found {discovered_from_albums} new artists from compilation/collaborative albums")

        # Print final statistics
        print("\n" + "="*60)
        print("🔄  Backfill Spider Session Complete")
        print("="*60)
        print(f"Artists Processed:         {backfilled_count}")
        if discover_from_albums and discovered_from_albums > 0:
            print(f"Discovered from Albums:    {discovered_from_albums}")
        print(f"Rejected (Blocklisted):    {self.stats['artists_rejected']}")
        print(f"Already Crawled (Skipped): {self.stats['artists_already_crawled']}")
        print(f"Total Tracks Found:        {self.stats['tracks_found']}")
        print("="*60)

        return self.stats

    def _discover_artists_from_albums(self, max_to_discover):
        """
        Discover new Swedish/Nordic folk artists from albums in our database.

        Strategy: Look at albums featuring our existing artists and discover
        other artists on those albums (compilations, collaborations, etc.)

        This is great for finding similar artists since if they're on the same
        compilation or collaborative album, they're likely the same genre.
        """
        from app.core.models import Album, Track, TrackArtist, Artist

        if max_to_discover <= 0:
            print("   ⚠️  Max discoveries limit reached, skipping album discovery")
            return 0

        discovered_count = 0

        # Get all albums in our database that have Spotify IDs (from track metadata)
        # We'll get unique album IDs from our tracks
        album_spotify_ids = set()

        # Query tracks with albums
        from app.core.models import TrackAlbum
        tracks_with_albums = self.db.query(Track).join(
            TrackAlbum, Track.id == TrackAlbum.track_id
        ).join(Album, TrackAlbum.album_id == Album.id).limit(100).all()

        for track in tracks_with_albums:
            # Get Spotify link to extract album ID
            spotify_link = next((l for l in track.playback_links if l.platform == 'spotify'), None)
            if not spotify_link:
                continue

            try:
                # Get track from Spotify to get album ID
                sp_track = self.sp.track(spotify_link.deep_link)
                if sp_track and sp_track.get('album') and sp_track['album'].get('id'):
                    album_spotify_ids.add(sp_track['album']['id'])
            except:
                continue

        print(f"   Found {len(album_spotify_ids)} unique albums to check for new artists")

        # Now check each album for new artists
        for album_id in list(album_spotify_ids)[:50]:  # Limit to 50 albums to avoid rate limiting
            if discovered_count >= max_to_discover:
                break

            try:
                # Get album details from Spotify
                album = self.sp.album(album_id)

                if not album or not album.get('tracks'):
                    continue

                # Look at all artists on this album
                album_artists = set()
                for track in album['tracks']['items']:
                    for artist in track.get('artists', []):
                        if artist.get('id'):
                            album_artists.add(artist['id'])

                # For each artist on the album, check if they're new and Swedish/Nordic folk
                for artist_id in album_artists:
                    if discovered_count >= max_to_discover:
                        break

                    # Skip if already crawled
                    existing_log = self.db.query(ArtistCrawlLog).filter(
                        ArtistCrawlLog.spotify_artist_id == artist_id
                    ).first()

                    if existing_log:
                        continue

                    # Skip if already in our database
                    existing_artist = self.db.query(Artist).filter(
                        Artist.spotify_id == artist_id
                    ).first()

                    if existing_artist:
                        continue

                    # Get artist details and check if Swedish/Nordic folk
                    try:
                        sp_artist = self.sp.artist(artist_id)
                        if self._evaluate_and_ingest(sp_artist):
                            discovered_count += 1
                            print(f"      📀 Discovered from album: {album.get('name', 'Unknown')}")
                    except Exception as e:
                        print(f"      ⚠️  Error checking artist {artist_id}: {e}")
                        continue

            except Exception as e:
                print(f"      ⚠️  Error checking album {album_id}: {e}")
                continue

        return discovered_count

    def _process_seed(self, db_track, max_to_crawl):
        """
        Process a seed track to discover related artists.
        Returns count of new artists discovered.
        """
        # Find a valid Spotify link for this track to get the Artist ID
        playback_link = next((l for l in db_track.playback_links if l.platform == 'spotify'), None)

        if not playback_link:
            print(f"      ⚠️  No Spotify link for '{db_track.title}'")
            return 0

        try:
            # Fetch track details from Spotify API
            sp_track = self.sp.track(playback_link.deep_link)

            if not sp_track or not sp_track['artists']:
                print(f"      ⚠️  No artist data for '{db_track.title}'")
                return 0

            artist_id = sp_track['artists'][0]['id']
            artist_name = sp_track['artists'][0]['name']

            print(f"   🕷️  Seeding from: {artist_name}")

            # Get Related Artists (The "Social Graph")
            try:
                related = self.sp.artist_related_artists(artist_id)
            except Exception as e:
                # Some artists don't have related artists data
                if 'Not Found' in str(e) or '404' in str(e):
                    print(f"      ⚠️  No related artists data available for {artist_name}")
                    return 0
                raise  # Re-raise unexpected errors

            if not related.get('artists'):
                print(f"      ⚠️  No related artists found for {artist_name}")
                return 0

            discovered_count = 0
            for artist in related['artists']:
                if discovered_count >= max_to_crawl:
                    break

                if self._evaluate_and_ingest(artist):
                    discovered_count += 1

            if discovered_count == 0:
                print(f"      (No new folk artists discovered)")

            return discovered_count

        except Exception as e:
            print(f"⚠️  Spider error processing seed '{db_track.title}': {e}")
            return 0

    def _evaluate_and_ingest(self, artist_obj):
        """
        Enhanced evaluation with:
        1. Rejection blocklist check
        2. Folk genre gatekeeper check
        3. Deduplication via ArtistCrawlLog
        4. Genre classification
        5. MANUAL VERIFICATION CHECK (New)
        6. Full discography ingestion

        Returns True if artist was newly crawled.
        """
        from app.core.models import Artist # Ensure import is available

        artist_id = artist_obj['id']
        name = artist_obj['name']
        genres = artist_obj.get('genres', [])

        self.stats['artists_evaluated'] += 1

        # STEP 1: REJECTION CHECK - Is this artist on the blocklist?
        rejected = self.db.query(RejectionLog).filter(
            RejectionLog.spotify_id == artist_id,
            RejectionLog.entity_type == 'artist'
        ).first()

        if rejected:
            self.stats['artists_rejected'] += 1
            print(f"      🚫 Skipping {name} (on rejection blocklist: {rejected.reason})")
            return False

        # STEP 2: CHECK EXISTING VERIFICATION STATUS (The Fix)
        # If we have manually approved/verified this artist, bypass the genre gatekeeper
        # and confidence checks. We want them in the feed.
        existing_db_artist = self.db.query(Artist).filter(Artist.spotify_id == artist_id).first()
        is_manually_verified = existing_db_artist and existing_db_artist.is_verified

        if is_manually_verified:
             print(f"      🛡️  Artist '{name}' is Manually Verified. Bypassing gatekeeper.")
        else:
            # Only run strict gatekeeper if NOT verified
            is_folk = self.genre_classifier.is_folk_artist(genres, name)
            if not is_folk:
                return False

        self.stats['artists_passed_gatekeeper'] += 1

        # STEP 3: DEDUPLICATION - Have we crawled this artist before?
        existing_log = self.db.query(ArtistCrawlLog).filter(
            ArtistCrawlLog.spotify_artist_id == artist_id
        ).first()

        if existing_log:
            self.stats['artists_already_crawled'] += 1
            print(f"      ⏭️  Skipping {name} (already crawled on {existing_log.crawled_at.date()})")
            return False

        # STEP 4: GENRE CLASSIFICATION
        music_genre, confidence = self.genre_classifier.classify_artist_genre(
            name, genres, None
        )

        # STEP 5: CONFIDENCE CHECK 
        # Should we auto-approve or queue for manual review?
        
        if is_manually_verified:
            # If verified, confidence is irrelevant. We want them.
            should_auto_approve = True
        else:
            # Auto-approve if:
            # 1. High confidence (>= 0.7) in genre classification, OR
            # 2. Artist has strong Swedish/Nordic folk signals in name/genres
            AUTO_APPROVE_CONFIDENCE = 0.7
            name_lower = name.lower()
            traditional_keywords = ['spelmanslag', 'riksspelman', 'folkmusik', 'polska']
            has_strong_folk_signal = any(kw in name_lower for kw in traditional_keywords)
            
            should_auto_approve = confidence >= AUTO_APPROVE_CONFIDENCE or has_strong_folk_signal

        if not should_auto_approve:
            # Queue for manual approval
            print(f"      ⏸️  Queuing for approval: {name}")
            print(f"         Genres: {genres}")
            print(f"         Classified as: {music_genre} ({confidence:.2f} confidence)")
            print(f"         Reason: Low confidence or uncertain genre match")

            try:
                # Check if already pending approval
                existing_pending = self.db.query(PendingArtistApproval).filter(
                    PendingArtistApproval.spotify_id == artist_id
                ).first()

                if existing_pending:
                    print(f"         Already pending approval")
                    return False

                # Get artist image
                image_url = artist_obj.get('images', [{}])[0].get('url') if artist_obj.get('images') else None

                pending = PendingArtistApproval(
                    spotify_id=artist_id,
                    name=name,
                    image_url=image_url,
                    discovery_source='spider',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    genre_confidence=confidence,
                    status='pending'
                )

                self.db.add(pending)
                self.db.commit()

                print(f"         ✅ Added to approval queue")
                self.stats['artists_pending_approval'] = self.stats.get('artists_pending_approval', 0) + 1
                return False  # Not crawled yet, waiting for approval

            except IntegrityError:
                self.db.rollback()
                return False
            except Exception as e:
                print(f"         ❌ Error queueing for approval: {e}")
                self.db.rollback()
                return False

        # Auto-approved (or Verified) - proceed with ingestion
        if is_manually_verified:
            print(f"      🎯 Updating Verified Artist: {name}")
        else:
            print(f"      🎯 Auto-approved Folk Artist: {name}")
            
        print(f"         Genres: {genres}")
        print(f"         Classified as: {music_genre} ({confidence:.2f} confidence)")

        # STEP 6: INGEST FULL DISCOGRAPHY
        time.sleep(0.5) 

        try:
            track_ids = self.ingestor.ingest_artist_albums(artist_id)

            # Queue tracks for analysis
            if track_ids:
                print(f"         ⚙️  Scheduling {len(track_ids)} tracks for analysis...")
                # Lazy import to avoid loading heavy ML dependencies
                from app.workers.tasks import analyze_track_task
                for tid in track_ids:
                    analyze_track_task.delay(tid)

            # STEP 7: LOG THE CRAWL
            crawl_log = ArtistCrawlLog(
                spotify_artist_id=artist_id,
                artist_name=name,
                tracks_found=len(track_ids) if isinstance(track_ids, list) else track_ids,
                status='success',
                detected_genres=genres,
                music_genre_classification=music_genre,
                discovery_source='spider'
            )

            self.db.add(crawl_log)
            self.db.commit()

            # STEP 8: UPDATE TRACK GENRES
            tracks_updated = self.genre_classifier.classify_all_tracks_for_artist(artist_id)
            if tracks_updated > 0:
                print(f"         🏷️  Tagged {tracks_updated} tracks as '{music_genre}'")

            self.stats['artists_crawled'] += 1
            self.stats['tracks_found'] += len(track_ids) if isinstance(track_ids, list) else track_ids

            return True

        except IntegrityError:
            self.db.rollback()
            self.stats['artists_already_crawled'] += 1
            return False

        except Exception as e:
            print(f"         ❌ Error ingesting {name}: {e}")
            try:
                crawl_log = ArtistCrawlLog(
                    spotify_artist_id=artist_id,
                    artist_name=name,
                    tracks_found=0,
                    status='failed',
                    detected_genres=genres,
                    music_genre_classification=music_genre,
                    discovery_source='spider'
                )
                self.db.add(crawl_log)
                self.db.commit()
            except:
                self.db.rollback()

            return False
