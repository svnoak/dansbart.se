package se.dansbart.domain.admin;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceMovementFeedback {

    private UUID id;
    private String danceStyle;
    private String movementTag;

    @Builder.Default
    private Float score = 0.0f;

    @Builder.Default
    private Integer occurrences = 0;
}
