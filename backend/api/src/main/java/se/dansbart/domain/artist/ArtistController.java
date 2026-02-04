package se.dansbart.domain.artist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/artists")
@RequiredArgsConstructor
@Tag(name = "Artists", description = "Artist discovery endpoints")
public class ArtistController {

    private final ArtistService artistService;
    private final TrackService trackService;

    @GetMapping
    @Operation(summary = "Get all artists with pagination")
    public ResponseEntity<Page<Artist>> getArtists(Pageable pageable) {
        return ResponseEntity.ok(artistService.findAll(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get artist by ID")
    public ResponseEntity<Artist> getArtist(@PathVariable UUID id) {
        return artistService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tracks")
    @Operation(summary = "Get all tracks by artist")
    public ResponseEntity<List<Track>> getArtistTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(trackService.findByArtistId(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search artists by name")
    public ResponseEntity<Page<Artist>> searchArtists(
            @RequestParam String q,
            Pageable pageable) {
        return ResponseEntity.ok(artistService.searchByName(q, pageable));
    }
}
