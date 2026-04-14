package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;

/**
 * Library statistics DTO.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StatsDto {

    private Long totalTracks;
    private Long analyzed;
    private Long classified;
    private Long pendingAnalysis;
    private Long pendingClassification;
    private Long failedTracks;
    private Long queuedTracks;
    private Integer coveragePercent;
    private OffsetDateTime lastAdded;
}
