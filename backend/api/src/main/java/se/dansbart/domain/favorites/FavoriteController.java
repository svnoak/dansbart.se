package se.dansbart.domain.favorites;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.TrackListDto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/favorites", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Favorites", description = "User track favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    @PostMapping("/{trackId}")
    @Operation(summary = "Toggle favorite status for a track")
    public ResponseEntity<Map<String, Boolean>> toggleFavorite(
            @PathVariable UUID trackId,
            @AuthenticationPrincipal UUID userId) {
        boolean favorited = favoriteService.toggle(userId, trackId);
        return ResponseEntity.ok(Map.of("favorited", favorited));
    }

    @GetMapping
    @Operation(summary = "Get all favorited track IDs for current user")
    public ResponseEntity<List<UUID>> getFavoriteIds(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(favoriteService.getFavoriteIds(userId));
    }

    @GetMapping("/tracks")
    @Operation(summary = "Get full track data for all favorited tracks")
    public ResponseEntity<List<TrackListDto>> getFavoriteTracks(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(favoriteService.getFavoriteTracks(userId));
    }
}
