package se.dansbart.domain.track;

import lombok.*;

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

    private String voterId;

    private String suggestedStyle;

    private String tempoCorrection;

    private OffsetDateTime createdAt;
}
