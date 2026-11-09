package se.dansbart.dto;

import java.util.List;

/** Everything users added that no admin has looked at yet. */
public record AdminContributionsDto(
    List<AdminTrackContributionDto> tracks,
    List<AdminStyleContributionDto> styles
) {}
