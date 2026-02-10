package se.dansbart.domain.admin.spotify;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/spotify")
@RequiredArgsConstructor
@Tag(name = "Admin Spotify", description = "Spotify preview and ingest endpoints")
public class AdminSpotifyController {

    private final AdminSpotifyService spotifyService;

    @GetMapping("/artist/{spotifyId}/albums")
    @Operation(summary = "Preview artist's albums from Spotify")
    public ResponseEntity<Map<String, Object>> getArtistAlbums(@PathVariable String spotifyId) {
        return ResponseEntity.ok(spotifyService.getArtistAlbums(spotifyId));
    }

    @GetMapping("/album/{spotifyId}/tracks")
    @Operation(summary = "Preview album's tracks from Spotify")
    public ResponseEntity<Map<String, Object>> getAlbumTracks(@PathVariable String spotifyId) {
        return ResponseEntity.ok(spotifyService.getAlbumTracks(spotifyId));
    }

    @PostMapping("/ingest/album")
    @Operation(summary = "Ingest album from Spotify")
    public ResponseEntity<Map<String, Object>> ingestAlbum(@RequestBody IngestAlbumRequest request) {
        return ResponseEntity.ok(spotifyService.ingestAlbum(request.spotifyAlbumId()));
    }

    @PostMapping("/ingest/track")
    @Operation(summary = "Ingest track from Spotify")
    public ResponseEntity<Map<String, Object>> ingestTrack(@RequestBody IngestTrackRequest request) {
        return ResponseEntity.ok(spotifyService.ingestTrack(request.spotifyTrackId()));
    }

    public record IngestAlbumRequest(String spotifyAlbumId) {}
    public record IngestTrackRequest(String spotifyTrackId) {}
}
