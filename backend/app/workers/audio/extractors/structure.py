import numpy as np

class StructureExtractor:
    """
    Folkmusik-stable structure extractor.
    Uses bar positions (from rhythm analysis) to infer sections,
    since Scandinavian fiddle tunes have stable and predictable phrasing.
    """

    def __init__(self):
        pass

    def extract_segments(self, bars):
        """
        Parameters
        ----------
        bars : list of float
            Bar times in seconds (from rhythm_extractor.get_bars())

        Returns
        -------
        list of float
            Structural section boundaries in seconds.
        """

        # ---- Safety checks ----
        if bars is None or len(bars) < 4:
            return [0.0]

        total_bars = len(bars)

        # ----- 1. Determine likely phrase length -----
        # Scandinavian folk typically: 8, 12, 16, 32
        candidates = [8, 12, 16, 32]

        # pick the candidate that divides the tune closest to an integer number of phrases
        ratios = [abs((total_bars / c) - round(total_bars / c)) for c in candidates]
        phrase_bars = candidates[int(np.argmin(ratios))]

        # If > 32 bars and strong periodicity, force 16 or 32
        if total_bars > 64 and phrase_bars < 16:
            phrase_bars = 16

        # ---- 2. Create section boundaries ----
        section_indices = list(range(0, total_bars, phrase_bars))

        # Always include the first bar as section start
        sections = [bars[idx] for idx in section_indices]

        # Ensure sorted unique values
        sections = sorted(list(set(sections)))

        # ---- 3. Guarantee at least [0.0] section ----
        if len(sections) == 0:
            return [0.0]

        # convert numpy types to python floats
        return [float(s) for s in sections]
