package se.dansbart.domain.submission;

import java.util.List;

/**
 * What a pasted link resolved to: the tracks behind it and a name for the whole
 * (album title, playlist name, artist or channel name; null for a single track).
 *
 * @param truncated true when the provider had more tracks than the per-link cap
 */
public record ResolvedSource(MusicLink link, String sourceName, List<SubmissionCandidate> tracks, boolean truncated) {}
