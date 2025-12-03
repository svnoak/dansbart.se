import os
import glob
import yt_dlp
import logging
import difflib # Used for title similarity scoring

class AudioFetcher:
    def __init__(self, temp_dir="./temp_audio"):
        self.temp_dir = temp_dir
        os.makedirs(self.temp_dir, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        
    def fetch_track_audio(self, track_id: str, query: str, expected_duration_ms: int = None) -> dict | None:
        """
        1. Searches YouTube for the top 20 results.
        2. Scores candidates based on duration match and title similarity.
        3. Downloads the best scoring match if confidence is above 60%.
        """
        self.cleanup(track_id)

        # Phase 1: Search Options (Metadata Only)
        search_opts = {
            'quiet': True,
            'noplaylist': True,
            'extract_flat': True, # Only fetch metadata
        }

        # Phase 2: Download Options (Heavy)
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

                best_match = self._find_best_match(entries, query, expected_duration_ms)
                
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

            # --- STEP D: RETURN RESULT ---
            expected_file = f"{self.temp_dir}/{track_id}.mp3"
            if os.path.exists(expected_file):
                return {
                    "file_path": expected_file,
                    "youtube_id": youtube_id,
                    "youtube_title": youtube_title
                }
                
        except Exception as e:
            self.logger.error(f"Download failed for {track_id}: {e}")
            return None
            
        return None

    def _find_best_match(self, entries: list, query: str, expected_duration_ms: int) -> dict | None:
        """
        Scores candidates based on duration match and title similarity (50/50).
        Returns the best matching entry dictionary, or None.
        """
        candidates = []
        
        TITLE_WEIGHT = 0.5
        DURATION_WEIGHT = 0.5 
        MIN_CONFIDENCE = 0.6 # Require at least 60% confidence overall

        for video_data in entries:
            score = 0
            
            # 1. MINIMUM VALIDATION (Forbidden keywords)
            if not self._passes_basic_filters(video_data, query):
                continue

            # 2. DURATION SCORE (Higher weight)
            yt_duration_sec = video_data.get('duration', 0)
            expected_sec = expected_duration_ms / 1000 if expected_duration_ms else 0
            
            if expected_sec > 0:
                # Allow a generous 20-second tolerance maximum
                max_diff = 20 
                duration_diff = abs(yt_duration_sec - expected_sec)
                
                # Score is 1.0 if difference is 0, falls to 0 if difference > 20s
                duration_score = max(0, 1 - (duration_diff / max_diff))
                score += duration_score * DURATION_WEIGHT
            else:
                score += 0.3 * DURATION_WEIGHT # Give partial score if no duration is available

            # 3. TITLE SCORE
            video_title = video_data.get('title', '').lower()
            query_lower = query.lower()
            
            # SequenceMatcher for similarity ratio
            title_similarity = difflib.SequenceMatcher(None, video_title, query_lower).ratio()
            score += title_similarity * TITLE_WEIGHT

            # Use the webpage_url as the key for download later
            candidates.append({'video': video_data, 'score': score, 'url': video_data.get('webpage_url')})

        # Sort by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)

        if candidates and candidates[0]['score'] > MIN_CONFIDENCE: 
            # Return the video data of the highest scored candidate
            return candidates[0]['video']
        
        return None

    def _passes_basic_filters(self, video_data: dict, query: str) -> bool:
        """
        Checks for obvious mismatches (like 'Karaoke' or 'Live' unless requested).
        """
        video_title = video_data.get('title', '').lower()
        query_lower = query.lower()
        
        # Forbidden keywords—if found in result but NOT in our specific query, reject it.
        forbidden_keywords = ['live', 'cover', 'karaoke', 'remix', 'mix', 'tutorial']
        
        for word in forbidden_keywords:
            if word in video_title and word not in query_lower:
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