package se.dansbart.domain.album;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.track.TrackService;
import se.dansbart.dto.AlbumDto;
import se.dansbart.dto.PageResponse;
import se.dansbart.dto.TrackListDto;

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
    public ResponseEntity<PageResponse<Album>> getAlbums(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "title") String sort,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        Pageable pageable = PageRequest.of(offset / limit, limit);
        Page<Album> page;
        if (search != null && !search.isBlank()) {
            page = albumService.searchByTitle(search, pageable);
        } else if ("random".equalsIgnoreCase(sort)) {
            page = albumService.findAllRandom(pageable);
        } else {
            page = albumService.findAll(pageable);
        }
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get album by ID")
    public ResponseEntity<AlbumDto> getAlbum(@PathVariable UUID id) {
        return albumService.findByIdAsDto(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tracks")
    @Operation(summary = "Get all tracks in album")
    public ResponseEntity<List<TrackListDto>> getAlbumTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(trackService.findByAlbumIdAsListDtos(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search albums by title")
    public ResponseEntity<PageResponse<Album>> searchAlbums(
            @RequestParam String q,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        Pageable pageable = PageRequest.of(offset / limit, limit);
        return ResponseEntity.ok(PageResponse.from(albumService.searchByTitle(q, pageable)));
    }
}
