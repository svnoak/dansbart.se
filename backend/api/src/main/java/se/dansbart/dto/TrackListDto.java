package se.dansbart.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * Minimal Track DTO for list views.
 * Reduces payload size for paginated responses.
 * Album cover is intentionally excluded (copyright).
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
    /** When listing with a style filter: the style that matched (may be secondary). Omitted when not filtering by style or when primary matched. */
    private String matchedStyle;
    private Integer effectiveBpm;
    private Float confidence;
    private Boolean hasVocals;

    // Primary artist name (flattened)
    private String artistName;

    // All working playback links (Spotify, YouTube, etc.) so UI can show both
    private List<PlaybackLinkDto> playbackLinks;
}
