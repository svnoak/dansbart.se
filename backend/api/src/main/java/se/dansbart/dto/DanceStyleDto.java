package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * DTO for dance style classification data.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceStyleDto {

    private UUID id;
    private String danceStyle;
    private String subStyle;
    private Boolean isPrimary;
    private Float confidence;
    private String tempoCategory;
    private Float bpmMultiplier;
    private Integer effectiveBpm;
    private Integer confirmationCount;
    private Boolean isUserConfirmed;
}
