package se.dansbart.domain.library;

import java.util.UUID;

public record LibrarySourceRefDto(UUID sourceId, String provider) {}
