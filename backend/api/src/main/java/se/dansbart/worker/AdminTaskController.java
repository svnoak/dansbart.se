package se.dansbart.worker;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;

import java.util.Map;
import java.util.UUID;

/**
 * Admin endpoints for triggering background tasks.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Administrative task management")
public class AdminTaskController {

    private final TaskDispatcher taskDispatcher;
    private final ArtistJooqRepository artistJooqRepository;

    @PostMapping("/trigger/reclassify")
    @Operation(summary = "Trigger library reclassification")
    public ResponseEntity<Map<String, String>> triggerReclassify() {
        taskDispatcher.dispatchReclassifyLibrary();
        return ResponseEntity.ok(Map.of("status", "dispatched", "task", "reclassify_library"));
    }

    @PostMapping("/trigger/spider")
    @Operation(summary = "Trigger spider crawl")
    public ResponseEntity<Map<String, String>> triggerSpider(
            @RequestParam(required = false) String seedArtistId) {
        taskDispatcher.dispatchSpiderCrawl(seedArtistId);
        return ResponseEntity.ok(Map.of("status", "dispatched", "task", "spider_crawl"));
    }

    @PostMapping("/trigger/analyze/{trackId}")
    @Operation(summary = "Trigger audio analysis for a track")
    public ResponseEntity<Map<String, String>> triggerAnalysis(@PathVariable UUID trackId) {
        taskDispatcher.dispatchAudioAnalysis(trackId);
        return ResponseEntity.ok(Map.of("status", "dispatched", "task", "analyze_track", "trackId", trackId.toString()));
    }

    @PostMapping("/trigger/backfill/{artistId}")
    @Operation(summary = "Trigger backfill for an artist (by internal artist UUID)")
    public ResponseEntity<Map<String, Object>> triggerBackfill(@PathVariable UUID artistId) {
        Artist artist = artistJooqRepository.findById(artistId).orElse(null);
        if (artist == null || artist.getSpotifyId() == null || artist.getSpotifyId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Artist not found or has no Spotify ID",
                "artistId", artistId.toString()
            ));
        }
        taskDispatcher.dispatchBackfillArtist(artist.getSpotifyId());
        return ResponseEntity.ok(Map.of("status", "dispatched", "task", "backfill_artist", "artistId", artistId.toString(), "spotifyId", artist.getSpotifyId()));
    }
}
