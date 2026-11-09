package se.dansbart.dto.request;

/**
 * Add a track to the public library from a YouTube or Spotify link.
 * title and artistName override what the link lookup found.
 * subStyle must belong to mainStyle. tempoCategory is optional.
 */
public record TrackSubmissionRequest(
    String url,
    String title,
    String artistName,
    String mainStyle,
    String subStyle,
    String tempoCategory
) {}
