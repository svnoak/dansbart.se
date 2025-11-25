import requests
import re
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
import music21
from collections import Counter

# Folkwiki Base URLs
BASE_URL = "http://www.folkwiki.se"
CATEGORY_URL = "http://www.folkwiki.se/Låttyper"

class FolkwikiScraper:
    def __init__(self, db: Session = None):
        self.db = db # Optional for now if just testing

    def build_ground_truth(self, category="Hambo", limit=20):
        print(f"🎻 Building Ground Truth for: {category}")
        
        # 1. Fetch the Category Page
        list_url = f"{CATEGORY_URL}/{category}"
        print(f"   Fetching category page: {list_url}")
        try:
            resp = requests.get(list_url)
            resp.raise_for_status()
        except Exception as e:
            print(f"❌ Failed to open category: {e}")
            return

        soup = BeautifulSoup(resp.content, 'html.parser')
        # Find links that look like wiki pages (usually in a list)
        # Folkwiki structure varies, but links are usually in the main content div
        links = [a['href'] for a in soup.select("div#wikitext a") if a['href'].startswith('/')]
        
        print(f"   Found {len(links)} potential tunes. Analyzing first {limit}...")

        stats = {
            "meters": Counter(),
            "avg_notes_per_bar": [],
            "common_rhythms": Counter()
        }

        count = 0
        for link in links:
            if count >= limit: break
            
            full_url = BASE_URL + link
            abc_content = self._fetch_abc_from_page(full_url)
            
            if abc_content:
                analysis = self._analyze_rhythm_fingerprint(abc_content)
                if analysis:
                    stats["meters"][analysis['meter']] += 1
                    stats["avg_notes_per_bar"].append(analysis['density'])
                    stats["common_rhythms"].update(analysis['patterns'])
                    print(f"   ✅ {analysis['title']} ({analysis['meter']}): Density={analysis['density']:.1f}")
                    count += 1

        self._print_summary(category, stats)

    def _fetch_abc_from_page(self, url):
        try:
            resp = requests.get(url)
            if resp.status_code != 200: return None
            
            # Folkwiki often puts ABC in a <pre> block
            soup = BeautifulSoup(resp.content, 'html.parser')
            pre_blocks = soup.find_all('pre')
            
            for pre in pre_blocks:
                text = pre.get_text()
                # Check if it looks like ABC (Has X: reference number)
                if "X:" in text and "K:" in text:
                    return text
            return None
        except:
            return None

    def _analyze_rhythm_fingerprint(self, abc_string):
        """
        Uses music21 to parse the score and extract rhythmic patterns.
        """
        try:
            # Parse ABC string
            tune = music21.converter.parse(abc_string, format='abc')
            
            # 1. Get Metadata
            title = tune.metadata.title if tune.metadata else "Unknown"
            ts = tune.getTimeSignatures()[0].ratioString if tune.getTimeSignatures() else "Unknown"
            
            # 2. Extract Rhythmic Patterns (Bar by Bar)
            # We verify what a "Standard Bar" looks like for this tune
            patterns = []
            note_counts = []
            
            # Flatten parts to get a single stream of measures
            parts = tune.parts
            if not parts: return None
            
            measures = parts[0].getElementsByClass('Measure')
            
            for m in measures:
                # Get notes and rests
                elements = m.notesAndRests
                if not elements: continue
                
                # Calculate Density
                note_counts.append(len(elements))
                
                # Calculate Pattern string (e.g. "1.0, 0.5, 0.5")
                # This represents quarter, eighth, eighth
                durations = [str(n.duration.quarterLength) for n in elements]
                pattern_str = "|".join(durations)
                patterns.append(pattern_str)

            if not note_counts: return None

            avg_density = sum(note_counts) / len(note_counts)
            
            return {
                "title": title,
                "meter": ts,
                "density": avg_density,
                "patterns": patterns
            }

        except Exception as e:
            # music21 can be finicky with bad ABC formatting
            # print(f"Music21 Error: {e}") 
            return None

    def _print_summary(self, category, stats):
        print(f"\n📊 GROUND TRUTH SUMMARY FOR: {category.upper()}")
        print("------------------------------------------------")
        
        print("Most Common Meters:")
        for m, c in stats['meters'].most_common(3):
            print(f"  - {m}: {c} tracks")
            
        avg_density = sum(stats['avg_notes_per_bar']) / len(stats['avg_notes_per_bar']) if stats['avg_notes_per_bar'] else 0
        print(f"\nAverage Note Density: {avg_density:.2f} notes/bar")
        
        print("\nDominant Rhythmic Patterns (Quarter Lengths):")
        # Showing top 5 patterns helps us identify the "Hambo Lilt" vs "Schottis Stomp"
        for pat, c in stats['common_rhythms'].most_common(5):
            print(f"  - [{pat}]: found in {c} bars")