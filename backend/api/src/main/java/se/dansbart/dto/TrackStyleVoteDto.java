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

    /** True if this specific vote was the one that newly confirmed the style (crossed
     *  VoterReputationService.CONFIRMATION_THRESHOLD for the first time), so the client
     *  can show concrete-impact feedback instead of a generic "thanks." */
    private boolean styleJustConfirmed;
}
