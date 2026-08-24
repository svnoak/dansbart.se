package se.dansbart.domain.spotify;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;

/**
 * Spotify preview and ingest endpoints, open to any authenticated user (see
 * SecurityConfig's specific rule for this path) — not admin-specific logic.
 *
 * URL path AND OpenAPI tag are kept exactly as before (`/api/admin/spotify`,
 * "Admin Spotify" — previously `AdminSpotifyController`) rather than renamed,
 * because renaming either would change the generated frontend client's folder/
 * import path (`@/api/generated/admin-spotify/...`), which requires regenerating
 * against a live backend — not available when this was split out. The admin
 * panel's existing generated client keeps working completely unchanged; a future
 * self-serve authenticated add-content page can import the same generated
 * functions. Renaming the URL/tag together with updating the frontend import is a
 * reasonable follow-up once someone can run `npm run api:update`.
 */
@RestController
@RequestMapping(value = "/api/admin/spotify", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Spotify", description = "Spotify preview and ingest endpoints (authenticated, not admin-only — see class javadoc)")
public class SpotifyIngestController {

    private final SpotifyIngestService spotifyIngestService;

    @GetMapping("/artist/{spotifyId}/albums")
    @Operation(summary = "Preview artist's albums from Spotify")
    public ResponseEntity<List<Map<String, Object>>> getArtistAlbums(@PathVariable String spotifyId) {
        return ResponseEntity.ok(spotifyIngestService.getArtistAlbums(spotifyId));
    }

    @GetMapping("/album/{spotifyId}/tracks")
    @Operation(summary = "Preview album's tracks from Spotify")
    public ResponseEntity<List<Map<String, Object>>> getAlbumTracks(@PathVariable String spotifyId) {
        return ResponseEntity.ok(spotifyIngestService.getAlbumTracks(spotifyId));
    }

    @PostMapping("/ingest/album")
    @Operation(summary = "Ingest album from Spotify")
    public ResponseEntity<Map<String, Object>> ingestAlbum(@RequestBody IngestAlbumRequest request) {
        return ResponseEntity.ok(spotifyIngestService.ingestAlbum(request.spotifyAlbumId()));
    }

    @PostMapping("/ingest/track")
    @Operation(summary = "Ingest track from Spotify")
    public ResponseEntity<Map<String, Object>> ingestTrack(@RequestBody IngestTrackRequest request) {
        return ResponseEntity.ok(spotifyIngestService.ingestTrack(request.spotifyTrackId()));
    }

    public record IngestAlbumRequest(String spotifyAlbumId) {}
    public record IngestTrackRequest(String spotifyTrackId) {}
}
