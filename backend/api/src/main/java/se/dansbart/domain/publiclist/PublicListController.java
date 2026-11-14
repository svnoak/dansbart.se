package se.dansbart.domain.publiclist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.dansbart.domain.dancelist.DanceListService;
import se.dansbart.domain.playlist.PlaylistService;
import se.dansbart.dto.PublicDanceListDto;
import se.dansbart.dto.PublicPlaylistDto;

import java.util.UUID;

/**
 * Read-only access to public playlists and public dance lists, for anyone. A list that is
 * private or missing gives 404, whoever asks, so a private list is never revealed.
 */
@RestController
@RequestMapping(value = "/api/public", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Public lists", description = "Public playlists and dance lists, readable without an account")
public class PublicListController {

    private final PlaylistService playlistService;
    private final DanceListService danceListService;

    @GetMapping("/playlists/{id}")
    @Operation(operationId = "getPublicPlaylist", summary = "Get a public playlist")
    public ResponseEntity<PublicPlaylistDto> getPublicPlaylist(@PathVariable UUID id) {
        return playlistService.findPublicByIdAsDto(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/dance-lists/{id}")
    @Operation(operationId = "getPublicDanceList", summary = "Get a public dance list")
    public ResponseEntity<PublicDanceListDto> getPublicDanceList(@PathVariable UUID id) {
        return danceListService.findPublicByIdAsDto(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
