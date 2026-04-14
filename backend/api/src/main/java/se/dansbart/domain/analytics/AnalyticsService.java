package se.dansbart.domain.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TrackPlaybackJooqRepository trackPlaybackJooqRepository;
    private final UserInteractionJooqRepository userInteractionJooqRepository;
    private final VisitorSessionJooqRepository visitorSessionJooqRepository;
    private final PathCountsJooqRepository pathCountsJooqRepository;

    @Transactional
    public TrackPlayback recordPlayback(UUID trackId, String platform, Integer durationSeconds, Boolean completed, String sessionId) {
        TrackPlayback playback = TrackPlayback.builder()
            .trackId(trackId)
            .platform(platform)
            .durationSeconds(durationSeconds)
            .completed(completed != null ? completed : false)
            .sessionId(sessionId)
            .build();
        return trackPlaybackJooqRepository.insert(playback);
    }

    @Transactional
    public UserInteraction recordInteraction(UUID trackId, String eventType, Map<String, Object> eventData, String sessionId) {
        UserInteraction interaction = UserInteraction.builder()
            .trackId(trackId)
            .eventType(eventType)
            .eventData(eventData)
            .sessionId(sessionId)
            .build();
        return userInteractionJooqRepository.insert(interaction);
    }

    @Transactional
    public VisitorSession createOrUpdateSession(
            String sessionId, String userAgent, Boolean isAuthenticated, String deviceType) {
        // Be defensive against missing/blank session IDs coming from older clients/tests.
        final String normalizedSessionId = (sessionId == null || sessionId.isBlank())
            ? UUID.randomUUID().toString()
            : sessionId;
        final String normalizedUserAgent = Objects.equals(userAgent, "null") ? null : userAgent;

        return visitorSessionJooqRepository.findBySessionId(normalizedSessionId)
            .map(session -> {
                session.setLastSeen(OffsetDateTime.now());
                session.setPageViews(session.getPageViews() + 1);
                session.setIsReturning(true);
                session.setUserAgent(normalizedUserAgent);
                // isAuthenticated only ever flips true — never demote back to anonymous
                if (Boolean.TRUE.equals(isAuthenticated)) {
                    session.setIsAuthenticated(true);
                }
                if (deviceType != null && session.getDeviceType() == null) {
                    session.setDeviceType(deviceType);
                }
                return visitorSessionJooqRepository.update(session);
            })
            .orElseGet(() -> {
                VisitorSession session = VisitorSession.builder()
                    .sessionId(normalizedSessionId)
                    .userAgent(normalizedUserAgent)
                    .lastSeen(OffsetDateTime.now())
                    .pageViews(1)
                    .isReturning(false)
                    .isAuthenticated(Boolean.TRUE.equals(isAuthenticated))
                    .deviceType(deviceType)
                    .build();
                return visitorSessionJooqRepository.insert(session);
            });
    }

    /** Mark that this session touched a site area. Idempotent. */
    @Transactional
    public void recordBehavioralFlag(String sessionId, String area) {
        if (sessionId == null || sessionId.isBlank()) return;
        visitorSessionJooqRepository.setSessionFlag(sessionId, area);
    }

    /** Increment the aggregate path counter for today. Query params are stripped. */
    @Transactional
    public void recordPathView(String path) {
        if (path == null || path.isBlank()) return;
        pathCountsJooqRepository.increment(normalizePath(path), LocalDate.now());
    }

    private String normalizePath(String path) {
        int q = path.indexOf('?');
        if (q >= 0) path = path.substring(0, q);
        // Collapse UUID path segments so /track/3f2a... and /track/9b1c... merge into /track/:id
        return path.replaceAll(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            ":id"
        );
    }
}
