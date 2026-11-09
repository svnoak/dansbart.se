package se.dansbart.dto;

import java.util.UUID;

/** A dance style a user added. subStyle is null for a new main style. */
public record ContributedStyleDto(UUID id, String mainStyle, String subStyle) {}
