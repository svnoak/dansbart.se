package se.dansbart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(name = "Track", description = "Track detail view used in public APIs")
public class TrackDto {

    @Schema(description = "Unique identifier of the track", example = "3f7a7b2e-4b9c-4b1d-9b9e-2a6c9e2d1f3a")
    private UUID id;

    @Schema(description = "Track title", example = "Polska efter Pekkos Per")
    private String title;

    @Schema(description = "Track duration in milliseconds", example = "215000")
    private Integer durationMs;

    @Schema(description = "When the track was first ingested into the system")
    private OffsetDateTime createdAt;

    // Audio features (user-visible)
    @Schema(description = "Whether the track contains vocals")
    private Boolean hasVocals;

    @Schema(description = "Perceived bounciness (0-1)")
    private Float bounciness;

    @Schema(description = "Perceived articulation (0-1)")
    private Float articulation;

    @Schema(description = "Swing ratio (0-1)")
    private Float swingRatio;

    // Classification
    @Schema(description = "Detected music genre label")
    private String musicGenre;

    @Schema(description = "Confidence for detected genre (0-1)")
    private Float genreConfidence;

    @Schema(description = "Processing status of the track (e.g. PENDING, READY)")
    private String processingStatus;

    // Primary dance style (flattened for convenience)
    @Schema(description = "Primary dance style label")
    private String danceStyle;

    @Schema(description = "Primary sub-style label")
    private String subStyle;

    @Schema(description = "Effective BPM for dancers")
    private Integer effectiveBpm;

    @Schema(description = "Tempo category label (e.g. SLOW, MEDIUM, FAST)")
    private String tempoCategory;

    @Schema(description = "Confidence for primary dance style (0-1)")
    private Float confidence;

    @Schema(description = "Whether the current style has been confirmed by users")
    private Boolean isUserConfirmed;

    // Nested DTOs
    @Schema(description = "Artists associated with this track")
    private List<ArtistSummaryDto> artists;

    @Schema(description = "Primary album for this track, if any")
    private AlbumSummaryDto album;

    @Schema(description = "Playable links for streaming this track")
    private List<PlaybackLinkDto> playbackLinks;

    @Schema(description = "All dance style candidates for this track")
    private List<DanceStyleDto> allDanceStyles;
}
