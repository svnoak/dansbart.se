package se.dansbart.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Track projection for the public Explorer page scatter plot and detail panel.
 * Carries R-pattern fields for visualization; lighter than TrackDto.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExplorerTrackDto {

    // Identity
    private UUID id;
    private String title;
    private String artistName;

    // Scatter plot axes
    private Float asymmetryScore;
    private Float tempoBpm;

    // Color / grouping dimension
    private String danceStyle;
    private String subStyle;
    private String musicGenre;

    // R-pattern bar chart
    private Float r1Mean;
    private Float r2Mean;
    private Float r3Mean;
    private String patternType;
    private Float asymmetryConsistency;

    // Meter quality flags
    private Float ternaryConfidence;
    private Boolean meterAmbiguous;

    // Detail panel supplementary
    private Float polskaScore;
    private Float hamboScore;
    private Float bpmStability;
    private Float swingRatio;
    private Float liltScore;
    private Float liltConsistency;
    private Float articulation;
    private Float bounciness;
    private Float loudness;
    private Float punchiness;
    private Float voiceProbability;

    // Classification metadata
    private Integer effectiveBpm;
    private String tempoCategory;
    private Float confidence;

    // Playback
    private List<PlaybackLinkDto> playbackLinks;
}
