package se.dansbart.domain.track;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserTrackSource(
    UUID id,
    UUID trackId,
    String title,
    String artist,
    String album,
    String provider,
    OffsetDateTime addedAt,
    boolean trackIsPrivate
) {}
