package se.dansbart.domain.track;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackFeelVote {

    private UUID id;
    private UUID trackId;
    private Track track;
    private String feelTag;
    private OffsetDateTime createdAt;
}
