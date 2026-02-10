package se.dansbart.domain.analytics;

import lombok.*;
import se.dansbart.domain.track.Track;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserInteraction {

    private UUID id;
    private UUID trackId;
    private Track track;
    private String eventType;
    private Map<String, Object> eventData;
    private OffsetDateTime createdAt;
    private String sessionId;
}
