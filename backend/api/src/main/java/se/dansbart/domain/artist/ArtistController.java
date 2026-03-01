package se.dansbart.domain.artist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.album.AlbumService;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackService;
import se.dansbart.dto.AlbumSummaryDto;
import se.dansbart.dto.ArtistDto;
import se.dansbart.dto.PageResponse;

import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/artists", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Artists", description = "Artist discovery endpoints")
public class ArtistController {

    private final ArtistService artistService;
    private final AlbumService albumService;
    private final TrackService trackService;

    @GetMapping
    @Operation(summary = "Get all artists with pagination")
    public ResponseEntity<PageResponse<Artist>> getArtists(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        Pageable pageable = PageRequest.of(offset / limit, limit);
        Page<Artist> page;
        if (search != null && !search.isBlank()) {
            page = artistService.searchByName(search, pageable);
        } else if ("random".equalsIgnoreCase(sort)) {
            page = artistService.findAllRandom(pageable);
        } else {
            page = artistService.findAll(pageable);
        }
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get artist by ID")
    public ResponseEntity<ArtistDto> getArtist(@PathVariable UUID id) {
        return artistService.findByIdAsDto(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/albums")
    @Operation(summary = "Get all albums by artist")
    public ResponseEntity<List<AlbumSummaryDto>> getArtistAlbums(
            @PathVariable UUID id) {
        return ResponseEntity.ok(
            artistService.findAlbumsByArtistIdAsSummaryDtos(id));
    }

    @GetMapping("/{id}/tracks")
    @Operation(summary = "Get all tracks by artist")
    public ResponseEntity<List<Track>> getArtistTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(trackService.findByArtistId(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search artists by name")
    public ResponseEntity<PageResponse<Artist>> searchArtists(
            @RequestParam String q,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        Pageable pageable = PageRequest.of(offset / limit, limit);
        return ResponseEntity.ok(PageResponse.from(artistService.searchByName(q, pageable)));
    }
}
