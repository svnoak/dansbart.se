import numpy as np
import librosa
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import AgglomerativeClustering

class ABSectionLabeler:
    def __init__(self, sr=16000, n_mfcc=13):
        self.sr = sr
        self.n_mfcc = n_mfcc

    def _extract_fingerprint(self, audio):
        """
        Compute a stable MFCC-based fingerprint for a section.
        Mean + delta-mean vector gives a compact and robust descriptor.
        """
        mfcc = librosa.feature.mfcc(y=audio, sr=self.sr, n_mfcc=self.n_mfcc)
        delta = librosa.feature.delta(mfcc)
        fp = np.concatenate([mfcc.mean(axis=1), delta.mean(axis=1)])
        return fp  # shape ~ 26

    def label_sections(self, audio, sections):
        """
        audio: full track mono float32
        sections: list of timestamps (seconds) delimiting each phrase boundary
        returns: ['A', 'A', 'B', 'A’', ...]
        """
        fingerprints = []

        # Extract fingerprints for each phrase
        for i in range(len(sections)):
            start = int(sections[i] * self.sr)
            end = int((sections[i+1] if i+1 < len(sections) else len(audio)/self.sr) * self.sr)
            chunk = audio[start:end]
            fingerprints.append(self._extract_fingerprint(chunk))

        fingerprints = np.array(fingerprints)

        # Compute similarity matrix
        sim = cosine_similarity(fingerprints)

        # Hierarchical clustering: normally 2–4 motifs in folk music
        n_clusters = min(4, len(fingerprints))
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            metric='euclidean',
            linkage='ward'
        ).fit(fingerprints)

        cluster_ids = clustering.labels_

        # Assign letters A, B, C...
        # Variants (A', B') when similarity is lower within the same cluster
        labels = []
        base_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

        # Map original cluster IDs to first-seen letters
        cluster_to_letter = {}
        next_letter_idx = 0

        # Keep a representative fingerprint per cluster for variant detection
        cluster_examples = {}

        for idx, cid in enumerate(cluster_ids):
            # Assign a base letter for new clusters
            if cid not in cluster_to_letter:
                cluster_to_letter[cid] = base_letters[next_letter_idx]
                next_letter_idx += 1

            letter = cluster_to_letter[cid]

            # Variant check: similarity with cluster representative
            if cid not in cluster_examples:
                cluster_examples[cid] = fingerprints[idx]
                labels.append(letter)
            else:
                rep_fp = cluster_examples[cid]
                similarity = cosine_similarity([rep_fp], [fingerprints[idx]])[0][0]

                # If highly similar → keep base letter, else → add prime for variant
                if similarity > 0.90:
                    labels.append(letter)
                else:
                    labels.append(letter + "'")

        return labels
