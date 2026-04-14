package se.dansbart.domain.admin.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.analytics.UserInteractionJooqRepository;
import se.dansbart.domain.analytics.VisitorSessionJooqRepository;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final VisitorSessionJooqRepository visitorRepository;
    private final TrackPlaybackJooqRepository playbackRepository;
    private final UserInteractionJooqRepository interactionRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final UserJooqRepository userJooqRepository;
    private final PlaylistJooqRepository playlistJooqRepository;

    public Map<String, Object> getDashboard(int days) {
        try {
            Map<String, Object> dashboard = new HashMap<>();
            dashboard.put("visitors", getVisitorStats(days));
            dashboard.put("mostPlayedTracks", getMostPlayedTracks(10, days));
            dashboard.put("listenTime", getListenTime(days));
            dashboard.put("platformStats", getPlatformStats(days));
            dashboard.put("reports", getReportStats(days));
            dashboard.put("discovery", getDiscoveryStats(days));
            dashboard.put("totalUsers", userJooqRepository.countAll());
            dashboard.put("totalPlaylists", playlistJooqRepository.countAll());
            return dashboard;
        } catch (Exception e) {
            // Return empty dashboard when analytics data is unavailable (e.g. fresh E2E DB)
            Map<String, Object> empty = new HashMap<>();
            empty.put("visitors", Map.of("totalVisitors", 0L, "totalPageViews", 0L, "loggedInVisitors", 0L, "anonymousVisitors", 0L, "mobileVisitors", 0L, "desktopVisitors", 0L, "days", days));
            empty.put("mostPlayedTracks", List.of());
            empty.put("listenTime", Map.of("totalSeconds", 0L, "totalMinutes", 0L, "totalHours", 0L, "days", days));
            empty.put("platformStats", Map.of("platforms", List.of(), "days", days));
            empty.put("reports", Map.of("total", 0L, "byType", Map.of(), "days", days));
            empty.put("discovery", Map.of("events", Map.of(), "days", days));
            empty.put("totalUsers", 0L);
            empty.put("totalPlaylists", 0L);
            return empty;
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getVisitorStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);

        long totalVisitors = visitorRepository.countUniqueSessionsSince(since);
        Long pageViews = visitorRepository.sumPageViewsSince(since);
        long loggedInVisitors = visitorRepository.countLoggedInSessionsSince(since);
        long anonymousVisitors = visitorRepository.countAnonymousSessionsSince(since);
        long mobileVisitors = visitorRepository.countMobileSessionsSince(since);
        long desktopVisitors = visitorRepository.countDesktopSessionsSince(since);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalVisitors", totalVisitors);
        stats.put("totalPageViews", pageViews != null ? pageViews : 0);
        stats.put("loggedInVisitors", loggedInVisitors);
        stats.put("anonymousVisitors", anonymousVisitors);
        stats.put("mobileVisitors", mobileVisitors);
        stats.put("desktopVisitors", desktopVisitors);
        stats.put("days", days);
        return stats;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getHourlyVisits(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> hourlyData = visitorRepository.countByHourOfDayWithTypes(since);

        List<Map<String, Object>> byHour = new ArrayList<>();
        for (Object[] row : hourlyData) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("hour", ((Number) row[0]).intValue());
            entry.put("total", ((Number) row[1]).longValue());
            entry.put("loggedIn", ((Number) row[2]).longValue());
            entry.put("anonymous", ((Number) row[3]).longValue());
            byHour.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("byHour", byHour);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyVisits(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> dailyData = visitorRepository.countByDateWithTypes(since);

        List<Map<String, Object>> byDate = new ArrayList<>();
        for (Object[] row : dailyData) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("date", row[0].toString());
            entry.put("total", ((Number) row[1]).longValue());
            entry.put("loggedIn", ((Number) row[2]).longValue());
            entry.put("anonymous", ((Number) row[3]).longValue());
            byDate.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("byDate", byDate);
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
            long totalDurationSeconds = row[3] != null ? ((Number) row[3]).longValue() : 0L;

            Track track = trackJooqRepository.findById(trackId).orElse(null);

            Map<String, Object> entry = new HashMap<>();
            entry.put("trackId", trackId.toString());
            entry.put("title", track != null ? track.getTitle() : "Unknown");
            entry.put("playCount", playCount);
            entry.put("completionRate", completionRate);
            entry.put("totalDurationSeconds", totalDurationSeconds);
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
        result.put("totalSeconds", total);
        result.put("totalMinutes", total / 60);
        result.put("totalHours", total / 3600);
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
            entry.put("playCount", ((Number) row[1]).longValue());
            entry.put("totalDuration", ((Number) row[2]).longValue());
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
        result.put("byType", byType);
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

    @Transactional(readOnly = true)
    public Map<String, Object> getNudgeStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> data = interactionRepository.countEventsByPrefix("nudge_", since);

        Map<String, Long> byEvent = new HashMap<>();
        for (Object[] row : data) {
            byEvent.put((String) row[0], ((Number) row[1]).longValue());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("events", byEvent);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getClassifyStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        List<Object[]> data = interactionRepository.countEventsByPrefix("classify_", since);

        Map<String, Long> byEvent = new HashMap<>();
        for (Object[] row : data) {
            byEvent.put((String) row[0], ((Number) row[1]).longValue());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("events", byEvent);
        result.put("days", days);
        return result;
    }
}
