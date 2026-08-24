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
 * Spotify preview and ingest endpoints. Open to any authenticated user — see
 * SecurityConfig's rule for this path — since nothing here is admin-specific.
 */
@RestController
@RequestMapping(value = "/api/spotify", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Spotify Ingest", description = "Spotify preview and ingest endpoints, authenticated users only")
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
