package se.dansbart.domain.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TrackPlaybackRepository trackPlaybackRepository;
    private final UserInteractionRepository userInteractionRepository;
    private final VisitorSessionRepository visitorSessionRepository;

    @Transactional
    public TrackPlayback recordPlayback(UUID trackId, String platform, Integer durationSeconds, Boolean completed, String sessionId) {
        TrackPlayback playback = TrackPlayback.builder()
            .trackId(trackId)
            .platform(platform)
            .durationSeconds(durationSeconds)
            .completed(completed != null ? completed : false)
            .sessionId(sessionId)
            .build();
        return trackPlaybackRepository.save(playback);
    }

    @Transactional
    public UserInteraction recordInteraction(UUID trackId, String eventType, Map<String, Object> eventData, String sessionId) {
        UserInteraction interaction = UserInteraction.builder()
            .trackId(trackId)
            .eventType(eventType)
            .eventData(eventData)
            .sessionId(sessionId)
            .build();
        return userInteractionRepository.save(interaction);
    }

    @Transactional
    public VisitorSession createOrUpdateSession(String sessionId, String userAgent) {
        // Be defensive against missing/blank session IDs coming from older clients/tests.
        // The DB column is NOT NULL + UNIQUE, so always persist a non-empty value.
        final String normalizedSessionId = (sessionId == null || sessionId.isBlank())
            ? UUID.randomUUID().toString()
            : sessionId;

        // Normalize userAgent to null-safe value (so we don't accidentally propagate the literal "null").
        final String normalizedUserAgent = Objects.equals(userAgent, "null") ? null : userAgent;

        return visitorSessionRepository.findBySessionId(normalizedSessionId)
            .map(session -> {
                session.setLastSeen(OffsetDateTime.now());
                session.setPageViews(session.getPageViews() + 1);
                session.setIsReturning(true);
                return visitorSessionRepository.save(session);
            })
            .orElseGet(() -> {
                VisitorSession session = VisitorSession.builder()
                    .sessionId(normalizedSessionId)
                    .userAgent(normalizedUserAgent)
                    .lastSeen(OffsetDateTime.now())
                    .pageViews(1)
                    .isReturning(false)
                    .build();
                return visitorSessionRepository.save(session);
            });
    }
}
