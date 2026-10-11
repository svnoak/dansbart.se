package se.dansbart.domain.submission;

/** One track as the provider names it, before anything is written. */
public record SubmissionCandidate(
    MusicLink.Provider provider,
    String externalId,
    String title,
    String artistName,
    String albumName
) {}
