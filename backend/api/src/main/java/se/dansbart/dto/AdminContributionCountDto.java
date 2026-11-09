package se.dansbart.dto;

/** Number of user additions that no admin has looked at yet. */
public record AdminContributionCountDto(long tracks, long styles) {}
