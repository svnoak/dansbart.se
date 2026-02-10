package se.dansbart.domain.analytics;

import lombok.*;
import se.dansbart.domain.track.Track;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackPlayback {

    private UUID id;
    private UUID trackId;
    private Track track;
    private String platform;
    private OffsetDateTime playedAt;
    private Integer durationSeconds;

    @Builder.Default
    private Boolean completed = false;

    private String sessionId;
}
