package se.dansbart.domain.admin.stats;

import se.dansbart.dto.StatsDto;

public record AdminStatsDto(
    StatsDto library,
    long privateTrackCount,
    long publicPlayCount,
    long privatePlayCount
) {}
