package se.dansbart.domain.admin.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.TrackPlaybackRepository;
import se.dansbart.domain.analytics.UserInteractionRepository;
import se.dansbart.domain.analytics.VisitorSessionRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final VisitorSessionRepository visitorRepository;
    private final TrackPlaybackRepository playbackRepository;
    private final UserInteractionRepository interactionRepository;
    private final TrackRepository trackRepository;

    public Map<String, Object> getDashboard(int days) {
        try {
            Map<String, Object> dashboard = new HashMap<>();
            dashboard.put("visitors", getVisitorStats(days));
            dashboard.put("most_played_tracks", getMostPlayedTracks(10, days));
            dashboard.put("listen_time", getListenTime(days));
            dashboard.put("platform_stats", getPlatformStats(days));
            dashboard.put("reports", getReportStats(days));
            dashboard.put("discovery", getDiscoveryStats(days));
            return dashboard;
        } catch (Exception e) {
            // Return empty dashboard when analytics data is unavailable (e.g. fresh E2E DB)
            Map<String, Object> empty = new HashMap<>();
            empty.put("visitors", Map.of("total_visitors", 0L, "total_page_views", 0L, "days", days));
            empty.put("most_played_tracks", List.of());
            empty.put("listen_time", Map.of("total_seconds", 0L, "total_minutes", 0L, "total_hours", 0L, "days", days));
            empty.put("platform_stats", Map.of("platforms", List.of(), "days", days));
            empty.put("reports", Map.of("total", 0L, "by_type", Map.of(), "days", days));
            empty.put("discovery", Map.of("events", Map.of(), "days", days));
            return empty;
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getVisitorStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);

        long totalVisitors = visitorRepository.countUniqueSessionsSince(since);
        Long pageViews = visitorRepository.sumPageViewsSince(since);

        Map<String, Object> stats = new HashMap<>();
        stats.put("total_visitors", totalVisitors);
        stats.put("total_page_views", pageViews != null ? pageViews : 0);
        stats.put("days", days);
        return stats;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getHourlyVisits(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> hourlyData = visitorRepository.countByHourOfDay(since);

        Map<Integer, Long> byHour = new HashMap<>();
        for (Object[] row : hourlyData) {
            int hour = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            byHour.put(hour, count);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("by_hour", byHour);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyVisits(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> dailyData = visitorRepository.countByDate(since);

        List<Map<String, Object>> byDate = new ArrayList<>();
        for (Object[] row : dailyData) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("date", row[0].toString());
            entry.put("count", ((Number) row[1]).longValue());
            byDate.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("by_date", byDate);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMostPlayedTracks(int limit, Integer days) {
        OffsetDateTime since = days != null ? OffsetDateTime.now().minusDays(days) : null;
        List<Object[]> data = playbackRepository.findMostPlayedTracks(since, limit);

        List<Map<String, Object>> tracks = new ArrayList<>();
        for (Object[] row : data) {
            UUID trackId = (UUID) row[0];
            long playCount = ((Number) row[1]).longValue();
            double completionRate = ((Number) row[2]).doubleValue();

            Track track = trackRepository.findById(trackId).orElse(null);

            Map<String, Object> entry = new HashMap<>();
            entry.put("track_id", trackId.toString());
            entry.put("title", track != null ? track.getTitle() : "Unknown");
            entry.put("play_count", playCount);
            entry.put("completion_rate", completionRate);
            tracks.add(entry);
        }
        return tracks;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getListenTime(Integer days) {
        OffsetDateTime since = days != null ? OffsetDateTime.now().minusDays(days) : null;
        Long totalSeconds = playbackRepository.sumDurationSeconds(since);
        long total = totalSeconds != null ? totalSeconds : 0;

        Map<String, Object> result = new HashMap<>();
        result.put("total_seconds", total);
        result.put("total_minutes", total / 60);
        result.put("total_hours", total / 3600);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPlatformStats(Integer days) {
        OffsetDateTime since = days != null ? OffsetDateTime.now().minusDays(days) : null;
        List<Object[]> data = playbackRepository.countByPlatform(since);

        List<Map<String, Object>> platforms = new ArrayList<>();
        for (Object[] row : data) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("platform", row[0]);
            entry.put("play_count", ((Number) row[1]).longValue());
            entry.put("total_duration", ((Number) row[2]).longValue());
            platforms.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("platforms", platforms);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getReportStats(Integer days) {
        OffsetDateTime since = days != null ? OffsetDateTime.now().minusDays(days) : null;
        List<Object[]> data = interactionRepository.countReportsByType(since);

        Map<String, Long> byType = new HashMap<>();
        long total = 0;
        for (Object[] row : data) {
            String type = (String) row[0];
            long count = ((Number) row[1]).longValue();
            byType.put(type, count);
            total += count;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("by_type", byType);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDiscoveryStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> data = interactionRepository.countDiscoveryEvents(since);

        Map<String, Long> byEvent = new HashMap<>();
        for (Object[] row : data) {
            String eventType = (String) row[0];
            long count = ((Number) row[1]).longValue();
            byEvent.put(eventType, count);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("events", byEvent);
        result.put("days", days);
        return result;
    }
}
