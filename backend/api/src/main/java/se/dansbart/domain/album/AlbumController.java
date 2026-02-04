package se.dansbart.domain.album;

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
@RequestMapping("/api/albums")
@RequiredArgsConstructor
@Tag(name = "Albums", description = "Album discovery endpoints")
public class AlbumController {

    private final AlbumService albumService;
    private final TrackService trackService;

    @GetMapping
    @Operation(summary = "Get all albums with pagination")
    public ResponseEntity<Page<Album>> getAlbums(Pageable pageable) {
        return ResponseEntity.ok(albumService.findAll(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get album by ID")
    public ResponseEntity<Album> getAlbum(@PathVariable UUID id) {
        return albumService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tracks")
    @Operation(summary = "Get all tracks in album")
    public ResponseEntity<List<Track>> getAlbumTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(trackService.findByAlbumId(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search albums by title")
    public ResponseEntity<Page<Album>> searchAlbums(
            @RequestParam String q,
            Pageable pageable) {
        return ResponseEntity.ok(albumService.searchByTitle(q, pageable));
    }
}
