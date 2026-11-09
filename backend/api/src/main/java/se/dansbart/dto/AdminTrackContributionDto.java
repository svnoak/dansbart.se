package se.dansbart.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** A track a user added, waiting for an admin to look at it. */
public record AdminTrackContributionDto(
    UUID submissionId,
    UUID trackId,
    String trackTitle,
    String source,
    String externalId,
    String title,
    String artistName,
    String mainStyle,
    String subStyle,
    String tempoCategory,
    String status,
    boolean createdTrack,
    String processingStatus,
    UUID userId,
    String username,
    boolean userBanned,
    OffsetDateTime createdAt
) {}
