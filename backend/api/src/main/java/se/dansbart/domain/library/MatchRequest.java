package se.dansbart.domain.library;

import jakarta.validation.constraints.Pattern;

public record MatchRequest(@Pattern(regexp = "^[0-9a-f]{64}$") String contentHash) {}
