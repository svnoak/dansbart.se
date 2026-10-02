package se.dansbart.domain.library;

import java.time.OffsetDateTime;
import java.util.UUID;

public record LibrarySourceDto(
    UUID sourceId,
    UUID trackId,
    String title,
    String artist,
    String album,
    String provider,
    OffsetDateTime addedAt,
    boolean linkedToCatalog
) {}
