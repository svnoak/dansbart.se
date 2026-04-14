package se.dansbart.domain.admin.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.PathCountsJooqRepository;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.analytics.UserInteractionJooqRepository;
import se.dansbart.domain.analytics.VisitorSessionJooqRepository;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;

import java.time.LocalDate;
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
    private final PathCountsJooqRepository pathCountsRepository;

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
            empty.put("visitors", Map.of("totalVisitors", 0L, "totalPageViews", 0L, "authenticatedVisitors", 0L, "anonymousVisitors", 0L, "mobileVisitors", 0L, "desktopVisitors", 0L, "days", days));
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
        long authenticatedVisitors = visitorRepository.countAuthenticatedSessionsSince(since);
        long anonymousVisitors = visitorRepository.countAnonymousSessionsSince(since);
        long mobileVisitors = visitorRepository.countMobileSessionsSince(since);
        long desktopVisitors = visitorRepository.countDesktopSessionsSince(since);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalVisitors", totalVisitors);
        stats.put("totalPageViews", pageViews != null ? pageViews : 0);
        stats.put("authenticatedVisitors", authenticatedVisitors);
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

    @Transactional(readOnly = true)
    public Map<String, Object> getSessionDurationStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        Double avgSeconds = visitorRepository.avgSessionDurationSecondsSince(since);
        long avg = avgSeconds != null ? avgSeconds.longValue() : 0L;

        Map<String, Object> result = new HashMap<>();
        result.put("avgDurationSeconds", avg);
        result.put("avgDurationMinutes", avg / 60.0);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBehavioralFlags(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        Map<String, Long> totals = visitorRepository.behavioralFlagCountsSince(since);
        List<Object[]> byDevice = visitorRepository.behavioralFlagsByDeviceTypeSince(since);

        List<Map<String, Object>> byDeviceList = new ArrayList<>();
        for (Object[] row : byDevice) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("deviceType",    row[0]);
            entry.put("total",         row[1]);
            entry.put("usedSearch",    row[2]);
            entry.put("usedPlaylists", row[3]);
            entry.put("usedLibrary",   row[4]);
            entry.put("usedDiscovery", row[5]);
            byDeviceList.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totals", totals);
        result.put("byDeviceType", byDeviceList);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSearchStats(int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);
        Object[] row = interactionRepository.getSearchStats(since);
        List<Object[]> topStyles = interactionRepository.getTopSearchedStyles(since, 10);

        Map<String, Object> filters = new HashMap<>();
        if (row != null) {
            long total = row[0] != null ? ((Number) row[0]).longValue() : 0L;
            filters.put("total",              total);
            filters.put("withQuery",          row[1] != null ? ((Number) row[1]).longValue() : 0L);
            filters.put("withStyle",          row[2] != null ? ((Number) row[2]).longValue() : 0L);
            filters.put("withTempo",          row[3] != null ? ((Number) row[3]).longValue() : 0L);
            filters.put("withDuration",       row[4] != null ? ((Number) row[4]).longValue() : 0L);
            filters.put("withBounciness",     row[5] != null ? ((Number) row[5]).longValue() : 0L);
            filters.put("withArticulation",   row[6] != null ? ((Number) row[6]).longValue() : 0L);
        } else {
            filters.put("total", 0L);
            filters.put("withQuery", 0L); filters.put("withStyle", 0L);
            filters.put("withTempo", 0L); filters.put("withDuration", 0L);
            filters.put("withBounciness", 0L); filters.put("withArticulation", 0L);
        }

        List<Map<String, Object>> styles = new ArrayList<>();
        for (Object[] s : topStyles) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("style", s[0]);
            entry.put("count", s[1]);
            styles.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("filters", filters);
        result.put("topStyles", styles);
        result.put("days", days);
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTopPaths(int days, int limit) {
        LocalDate since = LocalDate.now().minusDays(days);
        List<Object[]> data = pathCountsRepository.topPathsSince(since, limit);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : data) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("path",  row[0]);
            entry.put("total", row[1]);
            result.add(entry);
        }
        return result;
    }
}
