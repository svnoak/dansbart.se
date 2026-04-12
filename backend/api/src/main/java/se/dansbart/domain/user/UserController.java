package se.dansbart.domain.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistService;
import se.dansbart.dto.UserSummaryDto;
import se.dansbart.mapper.UserMapper;

import java.util.List;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/users", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Users", description = "User profile management endpoints")
public class UserController {

    private final UserService userService;
    private final PlaylistService playlistService;
    private final UserMapper userMapper;

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ResponseEntity<User> getCurrentUser(@AuthenticationPrincipal String userId) {
        return userService.findById(userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user profile")
    public ResponseEntity<User> updateProfile(
            @AuthenticationPrincipal String userId,
            @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(userId, request.displayName(), request.avatarUrl())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/me/playlists")
    @Operation(summary = "Get current user's playlists")
    public ResponseEntity<List<Playlist>> getMyPlaylists(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(playlistService.findByUserId(userId));
    }

    @GetMapping("/me/shared-playlists")
    @Operation(summary = "Get playlists shared with current user")
    public ResponseEntity<List<Playlist>> getSharedPlaylists(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(playlistService.findSharedWithUser(userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID (public profile)")
    public ResponseEntity<UserPublicProfile> getUserById(@PathVariable String id) {
        return userService.findById(id)
            .map(user -> new UserPublicProfile(user.getId(), user.getDisplayName(), user.getAvatarUrl()))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    @Operation(summary = "Search users by username or display name")
    public ResponseEntity<List<UserSummaryDto>> searchUsers(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        List<User> users = userService.searchUsers(q, Math.min(limit, 50));
        return ResponseEntity.ok(userMapper.toSummaryDtoList(users));
    }

    @GetMapping("/username/available")
    @Operation(summary = "Check if a username is available (case-insensitive)")
    public ResponseEntity<UsernameAvailability> checkUsernameAvailability(
            @RequestParam String username,
            @AuthenticationPrincipal String userId) {
        if (username.length() < 3 || username.length() > 50) {
            return ResponseEntity.ok(new UsernameAvailability(false, username));
        }
        boolean available = userService.isUsernameAvailable(username, userId);
        return ResponseEntity.ok(new UsernameAvailability(available, username));
    }

    public record UpdateProfileRequest(String displayName, String avatarUrl) {}

    public record UserPublicProfile(String id, String displayName, String avatarUrl) {}

    public record UsernameAvailability(boolean available, String username) {}
}
