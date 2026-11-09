package se.dansbart.domain.admin.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/users", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin: Users", description = "Admin user management endpoints")
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "List all users")
    public ResponseEntity<List<User>> listUsers() {
        return ResponseEntity.ok(userService.findAllUsers());
    }

    @PatchMapping("/{userId}")
    @Operation(summary = "Update a user's role")
    public ResponseEntity<Void> updateRole(
            @PathVariable UUID userId,
            @RequestBody UpdateRoleRequest request) {
        userService.setRole(userId, request.role());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/ban")
    @Operation(summary = "Ban a user from adding tracks and dance styles; their votes count as anonymous")
    public ResponseEntity<Void> banUser(@PathVariable UUID userId, @AuthenticationPrincipal UUID adminId) {
        return setBanned(userId, true, adminId);
    }

    @DeleteMapping("/{userId}/ban")
    @Operation(summary = "Lift a user's ban")
    public ResponseEntity<Void> unbanUser(@PathVariable UUID userId, @AuthenticationPrincipal UUID adminId) {
        return setBanned(userId, false, adminId);
    }

    private ResponseEntity<Void> setBanned(UUID userId, boolean banned, UUID adminId) {
        try {
            return userService.setBanned(userId, banned, adminId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    public record UpdateRoleRequest(String role) {}
}
