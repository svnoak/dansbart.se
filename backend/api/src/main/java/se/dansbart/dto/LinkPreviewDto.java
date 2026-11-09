package se.dansbart.dto;

import java.util.UUID;

/**
 * What a pasted link points at, before the track is added.
 * existingTrackId is set when the library already has a track with this link.
 */
public record LinkPreviewDto(
    String source,
    String externalId,
    String title,
    String artistName,
    Integer durationMs,
    UUID existingTrackId,
    String existingTrackTitle
) {}
