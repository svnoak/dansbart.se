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
    /** Share of tracks with a dance style that a person confirmed. */
    private Integer confirmedPercent;
    private OffsetDateTime lastAdded;
}
