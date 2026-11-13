package se.dansbart.domain.guestcode;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.GuestCodeDto;
import se.dansbart.dto.GuestListDto;

import java.util.UUID;

@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Guest codes", description = "Codes that let anyone add to a playlist or a dance list")
public class GuestCodeController {

    private final GuestCodeService guestCodeService;
    private final GuestCodeRateLimiter rateLimiter;

    @PostMapping("/api/playlists/{id}/guest-code")
    @Operation(operationId = "createPlaylistGuestCode", summary = "Create the guest code of a playlist; replaces a code that exists")
    public ResponseEntity<GuestCodeDto> createPlaylistGuestCode(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(guestCodeService.createForPlaylist(id, userId));
    }

    @DeleteMapping("/api/playlists/{id}/guest-code")
    @Operation(operationId = "removePlaylistGuestCode", summary = "Remove the guest code of a playlist")
    public ResponseEntity<Void> removePlaylistGuestCode(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        guestCodeService.removeForPlaylist(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/dance-lists/{id}/guest-code")
    @Operation(operationId = "createDanceListGuestCode", summary = "Create the guest code of a dance list; replaces a code that exists")
    public ResponseEntity<GuestCodeDto> createDanceListGuestCode(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(guestCodeService.createForDanceList(id, userId));
    }

    @DeleteMapping("/api/dance-lists/{id}/guest-code")
    @Operation(operationId = "removeDanceListGuestCode", summary = "Remove the guest code of a dance list")
    public ResponseEntity<Void> removeDanceListGuestCode(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        guestCodeService.removeForDanceList(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/public/guest-codes/{code}")
    @Operation(operationId = "getGuestList", summary = "Get the list a guest code belongs to")
    public ResponseEntity<GuestListDto> getGuestList(@PathVariable String code, HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        return ResponseEntity.ok(guestCodeService.findList(code));
    }

    @PostMapping("/api/public/guest-codes/{code}/tracks")
    @Operation(operationId = "addGuestTrack", summary = "Add a track to the playlist of a guest code")
    public ResponseEntity<GuestListDto> addGuestTrack(
            @PathVariable String code, @RequestBody AddGuestTrackRequest body, HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        return ResponseEntity.ok(guestCodeService.addTrack(code, body.trackId()));
    }

    @PostMapping("/api/public/guest-codes/{code}/dances")
    @Operation(operationId = "addGuestDance", summary = "Add a dance to the dance list of a guest code")
    public ResponseEntity<GuestListDto> addGuestDance(
            @PathVariable String code, @RequestBody AddGuestDanceRequest body, HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        return ResponseEntity.ok(guestCodeService.addDance(code, body.danceId(), body.name()));
    }

    public record AddGuestTrackRequest(UUID trackId) {}
    public record AddGuestDanceRequest(UUID danceId, String name) {}
}
