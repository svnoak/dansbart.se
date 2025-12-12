import os
import glob
import re
import yt_dlp
import logging
import difflib

class AudioFetcher:
    def __init__(self, temp_dir="./temp_audio"):
        self.temp_dir = temp_dir
        os.makedirs(self.temp_dir, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        self._expected_duration_ms = None  # Store for post-download verification
    
    def _normalize_title(self, title: str) -> str:
        """
        Normalize a title for comparison by removing common variations.
        """
        title = title.lower()
        # Remove content in parentheses/brackets (feat., remix info, etc.)
        title = re.sub(r'\([^)]*\)', '', title)
        title = re.sub(r'\[[^\]]*\]', '', title)
        # Remove common suffixes
        title = re.sub(r'\s*[-–—]\s*(official|audio|video|lyric|lyrics|hd|hq|4k|visualizer|visualiser).*$', '', title, flags=re.IGNORECASE)
        # Remove special characters and extra whitespace
        title = re.sub(r'[^\w\s]', ' ', title)
        title = re.sub(r'\s+', ' ', title).strip()
        return title
        
    def fetch_track_audio(self, track_id: str, query: str, expected_duration_ms: int = None, 
                          track_title: str = None, artist_name: str = None,
                          direct_video_id: str = None) -> dict | None:
        """
        1. If direct_video_id is provided, downloads that video directly.
        2. Otherwise, searches YouTube for the top 20 results.
        3. Scores candidates based on duration match and title similarity.
        4. Downloads the best scoring match if confidence is above threshold.
        
        Args:
            track_id: Unique identifier for the track
            query: Search query string
            expected_duration_ms: Expected track duration in milliseconds
            track_title: The exact track title from Spotify (for accurate matching)
            artist_name: The artist name from Spotify (for accurate matching)
            direct_video_id: If provided, skip search and download this video directly
        """
        self.cleanup(track_id)
        
        # Store these for use in matching
        self._track_title = track_title
        self._artist_name = artist_name
        self._expected_duration_ms = expected_duration_ms

        # Download Options
        dl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'{self.temp_dir}/{track_id}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128', 
            }],
            'quiet': True,
            'noplaylist': True,
        }

        try:
            # --- DIRECT DOWNLOAD PATH (User-provided link) ---
            if direct_video_id:
                self.logger.info(f"⬇️ Direct download for video ID: {direct_video_id}")
                video_url = f"https://www.youtube.com/watch?v={direct_video_id}"
                
                with yt_dlp.YoutubeDL(dl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=True)
                    youtube_id = info.get('id')
                    youtube_title = info.get('title')
                
                expected_file = f"{self.temp_dir}/{track_id}.mp3"
                
                # Verify downloaded audio
                verification = self._verify_downloaded_audio(expected_file)
                if not verification["valid"]:
                    self.logger.warning(f"⚠️ Direct download verification failed: {verification['reason']}")
                    # For direct links (user-provided), we still return it but log the warning
                    # User explicitly chose this link, so trust their judgment
                
                if os.path.exists(expected_file):
                    return {
                        "file_path": expected_file,
                        "youtube_id": youtube_id,
                        "youtube_title": youtube_title,
                        "verified": verification["valid"],
                        "actual_duration_ms": verification["actual_duration_ms"]
                    }
                return None

            # --- SEARCH PATH (No direct link provided) ---
            # Phase 1: Search Options (Metadata Only)
            search_opts = {
                'quiet': True,
                'noplaylist': True,
                'extract_flat': True, # Only fetch metadata
            }

            # --- STEP A: SEARCH & SCORE CANDIDATES ---
            with yt_dlp.YoutubeDL(search_opts) as ydl:
                self.logger.info(f"🔍 Searching top 20 for: {query}")
                
                # Explicitly search for the top 20 results
                search_query = f"ytsearch20:{query}" 
                
                info = ydl.extract_info(search_query, download=False)
                entries = info.get('entries', [])

                if not entries:
                    self.logger.warning(f"❌ Search found no results for {query}.")
                    return None

                best_match = self._find_best_match(entries, expected_duration_ms)
                
                if not best_match:
                    self.logger.warning(f"❌ All candidates rejected by filter.")
                    return None

                # --- STEP B: GET FULL INFO & DOWNLOAD ---
                # Retrieve full stream details using the verified URL/ID
                full_info = ydl.extract_info(best_match['url'], download=False)

                youtube_id = full_info.get('id')
                youtube_title = full_info.get('title')
                webpage_url = full_info.get('webpage_url')

            # --- STEP C: DOWNLOAD THE VERIFIED VIDEO ---
            with yt_dlp.YoutubeDL(dl_opts) as ydl:
                self.logger.info(f"⬇️ Downloading verified match: {youtube_title}")
                # Download using the verified webpage URL
                ydl.download([webpage_url])

            # --- STEP D: VERIFY & RETURN RESULT ---
            expected_file = f"{self.temp_dir}/{track_id}.mp3"
            
            if os.path.exists(expected_file):
                # Post-download verification
                verification = self._verify_downloaded_audio(expected_file)
                
                if not verification["valid"]:
                    self.logger.warning(f"⚠️ Post-download verification failed: {verification['reason']}")
                    # Clean up the bad file
                    self.cleanup(track_id)
                    return None
                
                self.logger.info(f"✅ Audio verified: {verification['reason']}")
                return {
                    "file_path": expected_file,
                    "youtube_id": youtube_id,
                    "youtube_title": youtube_title,
                    "verified": True,
                    "actual_duration_ms": verification["actual_duration_ms"]
                }
                
        except Exception as e:
            self.logger.error(f"Download failed for {track_id}: {e}")
            return None
            
        return None

    def _find_best_match(self, entries: list, expected_duration_ms: int) -> dict | None:
        """
        Scores candidates based on:
        - Title match (must contain the track title) - 40%
        - Artist match (should contain artist name) - 20%  
        - Duration match (within tolerance) - 40%
        
        Returns the best matching entry dictionary, or None.
        """
        candidates = []
        
        TITLE_WEIGHT = 0.4
        ARTIST_WEIGHT = 0.2
        DURATION_WEIGHT = 0.4
        MIN_CONFIDENCE = 0.65  # Require at least 65% confidence overall
        MIN_TITLE_SIMILARITY = 0.5  # Track title must have at least 50% similarity

        track_title = self._track_title or ""
        artist_name = self._artist_name or ""
        
        normalized_track_title = self._normalize_title(track_title)
        normalized_artist = self._normalize_title(artist_name)

        for video_data in entries:
            score = 0
            
            video_title = video_data.get('title', '')
            normalized_video_title = self._normalize_title(video_title)
            video_channel = video_data.get('channel', '').lower() if video_data.get('channel') else ''
            
            # 1. MINIMUM VALIDATION (Forbidden keywords)
            if not self._passes_basic_filters(video_data, track_title):
                continue

            # 2. TITLE SCORE - Check if track title is present in video title
            title_similarity = 0
            if normalized_track_title:
                # Check direct containment first
                if normalized_track_title in normalized_video_title:
                    title_similarity = 1.0
                else:
                    # Fall back to sequence matching on just the title portion
                    title_similarity = difflib.SequenceMatcher(
                        None, normalized_track_title, normalized_video_title
                    ).ratio()
                    
                    # Also check if all words from track title appear in video title
                    track_words = set(normalized_track_title.split())
                    video_words = set(normalized_video_title.split())
                    if track_words and track_words.issubset(video_words):
                        title_similarity = max(title_similarity, 0.9)
            
            # Skip if title similarity is too low - this is our main filter
            if normalized_track_title and title_similarity < MIN_TITLE_SIMILARITY:
                self.logger.debug(f"   ⏭️ Skipping '{video_title}' - title similarity too low ({title_similarity:.2f})")
                continue
                
            score += title_similarity * TITLE_WEIGHT

            # 3. ARTIST SCORE - Check if artist appears in video title or channel
            artist_similarity = 0
            if normalized_artist:
                # Check in video title
                if normalized_artist in normalized_video_title:
                    artist_similarity = 1.0
                # Check in channel name
                elif normalized_artist in video_channel:
                    artist_similarity = 0.9
                else:
                    # Partial match
                    artist_similarity = max(
                        difflib.SequenceMatcher(None, normalized_artist, normalized_video_title).ratio(),
                        difflib.SequenceMatcher(None, normalized_artist, video_channel).ratio()
                    )
            else:
                artist_similarity = 0.5  # Neutral if no artist provided
                
            score += artist_similarity * ARTIST_WEIGHT

            # 4. DURATION SCORE
            yt_duration_sec = video_data.get('duration', 0)
            expected_sec = expected_duration_ms / 1000 if expected_duration_ms else 0
            
            if expected_sec > 0 and yt_duration_sec > 0:
                # Allow 15-second tolerance (tighter than before)
                max_diff = 15
                duration_diff = abs(yt_duration_sec - expected_sec)
                
                # Score is 1.0 if difference is 0, falls to 0 if difference > 15s
                duration_score = max(0, 1 - (duration_diff / max_diff))
                score += duration_score * DURATION_WEIGHT
            else:
                score += 0.3 * DURATION_WEIGHT  # Give partial score if no duration is available

            # Bonus: "Topic" channels are usually official audio
            if "topic" in video_channel or "- topic" in video_channel:
                score += 0.05

            candidates.append({
                'video': video_data, 
                'score': score, 
                'url': video_data.get('webpage_url'),
                'title_sim': title_similarity,
                'artist_sim': artist_similarity
            })
            
            self.logger.debug(f"   📊 '{video_title}' - Score: {score:.2f} (title: {title_similarity:.2f}, artist: {artist_similarity:.2f})")

        # Sort by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)

        if candidates:
            best = candidates[0]
            self.logger.info(f"   🏆 Best match: '{best['video'].get('title')}' (score: {best['score']:.2f})")
            
            if best['score'] >= MIN_CONFIDENCE:
                return best['video']
            else:
                self.logger.warning(f"   ⚠️ Best score {best['score']:.2f} below threshold {MIN_CONFIDENCE}")
        
        return None

    def _passes_basic_filters(self, video_data: dict, track_title: str) -> bool:
        """
        Checks for obvious mismatches (like 'Karaoke' or 'Live' unless requested).
        """
        video_title = video_data.get('title', '').lower()
        track_title_lower = track_title.lower() if track_title else ""
        
        # Forbidden keywords—if found in result but NOT in our specific track title, reject it.
        forbidden_keywords = ['live', 'cover', 'karaoke', 'remix', 'mix', 'tutorial', 'instrumental', 'acoustic', 'slowed', 'reverb', 'sped up', '8d']
        
        for word in forbidden_keywords:
            if word in video_title and word not in track_title_lower:
                return False
        
        # Reject very short videos (likely previews) or very long ones (likely compilations)
        duration = video_data.get('duration', 0)
        if duration > 0 and (duration < 60 or duration > 600):  # Less than 1 min or more than 10 min
            return False
        
        return True

    def cleanup(self, track_id: str):
        """Public cleanup method"""
        files = glob.glob(f"{self.temp_dir}/{track_id}.*")
        for f in files:
            try:
                os.remove(f)
            except OSError:
                pass

    def _verify_downloaded_audio(self, file_path: str) -> dict:
        """
        Verifies the downloaded audio file:
        1. File exists and is readable
        2. Duration matches expected (within tolerance)
        
        Returns: {"valid": bool, "actual_duration_ms": int, "reason": str}
        """
        if not os.path.exists(file_path):
            return {"valid": False, "actual_duration_ms": 0, "reason": "File not found"}
        
        try:
            from mutagen.mp3 import MP3

            audio = MP3(file_path)
            actual_duration_ms = int(audio.info.length * 1000)
            
            # If no expected duration, just verify file is valid
            if not self._expected_duration_ms:
                return {"valid": True, "actual_duration_ms": actual_duration_ms, "reason": "No expected duration to compare"}
            
            # Calculate difference
            diff_ms = abs(actual_duration_ms - self._expected_duration_ms)
            diff_seconds = diff_ms / 1000
            
            # Allow 10 second tolerance (tighter than search filter)
            # This catches cases where search matched but actual audio differs
            if diff_seconds <= 10:
                return {
                    "valid": True, 
                    "actual_duration_ms": actual_duration_ms, 
                    "reason": f"Duration match (diff: {diff_seconds:.1f}s)"
                }
            else:
                return {
                    "valid": False, 
                    "actual_duration_ms": actual_duration_ms, 
                    "reason": f"Duration mismatch: expected {self._expected_duration_ms/1000:.0f}s, got {actual_duration_ms/1000:.0f}s (diff: {diff_seconds:.1f}s)"
                }
                
        except Exception as e:
            self.logger.error(f"Audio verification failed: {e}")
            return {"valid": False, "actual_duration_ms": 0, "reason": f"Verification error: {e}"}