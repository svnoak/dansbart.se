package se.dansbart.domain.track;

import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackStyleVote {

    private UUID id;

    private UUID trackId;

    private Track track;

    private UUID voterId;

    private String suggestedStyle;

    private String tempoCorrection;

    @Builder.Default
    private BigDecimal weight = BigDecimal.ONE;

    private OffsetDateTime createdAt;
}
