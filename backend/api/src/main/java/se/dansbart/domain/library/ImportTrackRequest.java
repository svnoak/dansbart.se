package se.dansbart.domain.library;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ImportTrackRequest(
    @Pattern(regexp = "^[0-9a-f]{64}$") String contentHash,
    @Pattern(regexp = "^(LOCAL|GDRIVE|HIDRIVE)$") String provider,
    String providerFileId,
    @NotBlank String title,
    String artist,
    String album,
    Integer durationMs,
    String isrc
) {}
