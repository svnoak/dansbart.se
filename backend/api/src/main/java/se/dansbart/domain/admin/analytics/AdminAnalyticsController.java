package se.dansbart.domain.admin.analytics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin/analytics", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Analytics", description = "Analytics dashboard and statistics endpoints")
public class AdminAnalyticsController {

    private final AdminAnalyticsService analyticsService;

    @GetMapping("/dashboard")
    @Operation(summary = "Get comprehensive analytics dashboard data")
    public ResponseEntity<Map<String, Object>> getDashboard(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getDashboard(days));
    }

    @GetMapping("/visitors")
    @Operation(summary = "Get visitor statistics")
    public ResponseEntity<Map<String, Object>> getVisitorStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getVisitorStats(days));
    }

    @GetMapping("/visits/hourly")
    @Operation(summary = "Get visit patterns by hour of day")
    public ResponseEntity<Map<String, Object>> getHourlyVisits(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getHourlyVisits(days));
    }

    @GetMapping("/visits/daily")
    @Operation(summary = "Get visit patterns by date")
    public ResponseEntity<Map<String, Object>> getDailyVisits(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getDailyVisits(days));
    }

    @GetMapping("/tracks/most-played")
    @Operation(summary = "Get most played tracks with completion rates")
    public ResponseEntity<List<Map<String, Object>>> getMostPlayedTracks(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Integer days) {
        return ResponseEntity.ok(analyticsService.getMostPlayedTracks(limit, days));
    }

    @GetMapping("/listen-time")
    @Operation(summary = "Get total listen time across all tracks")
    public ResponseEntity<Map<String, Object>> getListenTime(
            @RequestParam(required = false) Integer days) {
        return ResponseEntity.ok(analyticsService.getListenTime(days));
    }

    @GetMapping("/platform-stats")
    @Operation(summary = "Get detailed platform usage statistics")
    public ResponseEntity<Map<String, Object>> getPlatformStats(
            @RequestParam(required = false) Integer days) {
        return ResponseEntity.ok(analyticsService.getPlatformStats(days));
    }

    @GetMapping("/reports")
    @Operation(summary = "Get statistics on all types of reports")
    public ResponseEntity<Map<String, Object>> getReportStats(
            @RequestParam(required = false) Integer days) {
        return ResponseEntity.ok(analyticsService.getReportStats(days));
    }

    @GetMapping("/discovery")
    @Operation(summary = "Get analytics for the discovery page feature")
    public ResponseEntity<Map<String, Object>> getDiscoveryStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getDiscoveryStats(days));
    }

    @GetMapping("/nudge")
    @Operation(summary = "Get SmartNudge funnel statistics")
    public ResponseEntity<Map<String, Object>> getNudgeStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getNudgeStats(days));
    }

    @GetMapping("/classify")
    @Operation(summary = "Get classify game activity statistics")
    public ResponseEntity<Map<String, Object>> getClassifyStats(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.getClassifyStats(days));
    }
}
