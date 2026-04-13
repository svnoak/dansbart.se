package se.dansbart.domain.admin.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    public record UpdateRoleRequest(String role) {}
}
