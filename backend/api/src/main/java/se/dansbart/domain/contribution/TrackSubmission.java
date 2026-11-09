package se.dansbart.domain.contribution;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One "add track" request from a signed-in user. See V32__add_user_contributions.sql. */
public record TrackSubmission(
    UUID id,
    UUID userId,
    String source,
    String externalId,
    String title,
    String artistName,
    String danceStyle,
    String subStyle,
    String tempoCategory,
    UUID trackId,
    boolean createdTrack,
    String status,
    OffsetDateTime reviewedAt,
    OffsetDateTime createdAt
) {
    public static final String QUEUED = "QUEUED";
    public static final String LINKED = "LINKED";
    public static final String DONE = "DONE";
    public static final String FAILED = "FAILED";
}
