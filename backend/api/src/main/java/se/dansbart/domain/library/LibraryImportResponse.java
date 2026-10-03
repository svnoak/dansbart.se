package se.dansbart.domain.library;

import java.util.UUID;

public record LibraryImportResponse(
    UUID sourceId,
    UUID trackId,
    boolean linkedToCatalog,
    boolean skipped
) {}
