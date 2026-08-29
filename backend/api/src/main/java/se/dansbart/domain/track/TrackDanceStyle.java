package se.dansbart.domain.track;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackDanceStyle {

    private UUID id;

    private UUID trackId;

    private Track track;

    private String danceStyle;

    private String subStyle;

    @Builder.Default
    private Boolean isPrimary = false;

    @Builder.Default
    private Float confidence = 0.0f;

    private String tempoCategory;

    @Builder.Default
    private Float bpmMultiplier = 1.0f;

    private Integer effectiveBpm;

    /** Where this classification came from: 'metadata' (keyword match), 'ml' (groove-
     *  fingerprint prediction), or 'heuristic' (math/structure guess). Null for rows
     *  predating this column. */
    private String source;

    @Builder.Default
    private Integer confirmationCount = 0;

    @Builder.Default
    private Boolean isUserConfirmed = false;
}
