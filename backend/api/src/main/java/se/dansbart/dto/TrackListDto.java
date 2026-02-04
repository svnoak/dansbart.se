package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * Minimal Track DTO for list views.
 * Reduces payload size for paginated responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackListDto {

    private UUID id;
    private String title;
    private Integer durationMs;

    // Primary classification
    private String danceStyle;
    private String subStyle;
    private Integer effectiveBpm;
    private Float confidence;
    private Boolean hasVocals;

    // Primary artist name (flattened)
    private String artistName;

    // Album cover for display
    private String albumCoverUrl;

    // First playback link
    private String playbackPlatform;
    private String playbackLink;
}
