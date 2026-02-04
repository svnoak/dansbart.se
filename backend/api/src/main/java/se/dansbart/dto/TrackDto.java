package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Data Transfer Object for Track entity.
 * Used for API responses - excludes internal processing fields.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackDto {

    private UUID id;
    private String title;
    private Integer durationMs;
    private OffsetDateTime createdAt;

    // Audio features (user-visible)
    private Boolean hasVocals;
    private Float bounciness;
    private Float articulation;
    private Float swingRatio;

    // Classification
    private String musicGenre;
    private Float genreConfidence;
    private String processingStatus;

    // Primary dance style (flattened for convenience)
    private String danceStyle;
    private String subStyle;
    private Integer effectiveBpm;
    private String tempoCategory;
    private Float confidence;
    private Boolean isUserConfirmed;

    // Nested DTOs
    private List<ArtistSummaryDto> artists;
    private AlbumSummaryDto album;
    private List<PlaybackLinkDto> playbackLinks;
    private List<DanceStyleDto> allDanceStyles;
}
