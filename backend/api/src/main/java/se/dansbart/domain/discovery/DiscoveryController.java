package se.dansbart.domain.discovery;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.track.Track;
import se.dansbart.dto.CuratedPlaylistDto;
import se.dansbart.dto.StyleOverviewDto;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/discovery")
@RequiredArgsConstructor
@Tag(name = "Discovery", description = "Track discovery endpoints for homepage and exploration")
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    @GetMapping("/popular")
    @Operation(summary = "Get popular tracks based on play count and completion rate")
    public ResponseEntity<List<Track>> getPopularTracks(
            @Parameter(description = "Number of tracks to return (1-20)")
            @RequestParam(defaultValue = "6") int limit,
            @Parameter(description = "Days to look back for popularity (1-90)")
            @RequestParam(defaultValue = "7") int days) {

        // Validate and clamp parameters
        limit = Math.max(1, Math.min(20, limit));
        days = Math.max(1, Math.min(90, days));

        return ResponseEntity.ok(discoveryService.findPopularTracks(limit, days));
    }

    @GetMapping("/recent")
    @Operation(summary = "Get recently added tracks with verified classification")
    public ResponseEntity<List<Track>> getRecentTracks(
            @Parameter(description = "Number of tracks to return (1-20)")
            @RequestParam(defaultValue = "6") int limit) {

        limit = Math.max(1, Math.min(20, limit));
        return ResponseEntity.ok(discoveryService.findRecentTracks(limit));
    }

    @GetMapping("/curated")
    @Operation(summary = "Get curated high-quality tracks")
    public ResponseEntity<List<Track>> getCuratedTracks(
            @Parameter(description = "Number of tracks to return (1-20)")
            @RequestParam(defaultValue = "6") int limit) {

        limit = Math.max(1, Math.min(20, limit));
        try {
            return ResponseEntity.ok(discoveryService.findCuratedTracks(limit));
        } catch (Exception e) {
            // Return empty list when query fails (e.g. fresh E2E DB, missing analytics tables)
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    @GetMapping("/by-style")
    @Operation(summary = "Get style overview with track counts")
    public ResponseEntity<List<StyleOverviewDto>> getStyleOverview() {
        return ResponseEntity.ok(discoveryService.getStyleOverview());
    }

    @GetMapping("/playlists")
    @Operation(summary = "Get curated playlists with tracks for discovery page")
    public ResponseEntity<List<CuratedPlaylistDto>> getCuratedPlaylists() {
        return ResponseEntity.ok(discoveryService.getCuratedPlaylists());
    }
}
