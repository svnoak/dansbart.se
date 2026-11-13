package se.dansbart.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** A dance style a user added, waiting for an admin to look at it. */
public record AdminStyleContributionDto(
    UUID id,
    String mainStyle,
    String subStyle,
    UUID userId,
    String username,
    boolean userBanned,
    OffsetDateTime createdAt
) {}
