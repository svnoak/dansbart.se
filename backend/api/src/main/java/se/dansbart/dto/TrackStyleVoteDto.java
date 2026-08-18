package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DTO for a submitted style/tempo correction vote.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackStyleVoteDto {

    private UUID id;
    private UUID trackId;
    private String suggestedStyle;
    private String tempoCorrection;
    private OffsetDateTime createdAt;
}
