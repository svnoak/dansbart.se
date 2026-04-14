package se.dansbart.domain.analytics;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VisitorSession {

    private UUID id;
    private String sessionId;
    private OffsetDateTime firstSeen;
    private OffsetDateTime lastSeen;
    private String userAgent;

    @Builder.Default
    private Boolean isReturning = false;

    @Builder.Default
    private Integer pageViews = 1;

    private UUID userId;
    private String deviceType;
}
