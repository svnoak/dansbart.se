package se.dansbart.domain.analytics;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "visitor_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VisitorSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", unique = true, nullable = false)
    private String sessionId;

    @Column(name = "first_seen", insertable = false, updatable = false)
    private OffsetDateTime firstSeen;

    @Column(name = "last_seen")
    private OffsetDateTime lastSeen;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "is_returning")
    @Builder.Default
    private Boolean isReturning = false;

    @Column(name = "page_views")
    @Builder.Default
    private Integer pageViews = 1;
}
