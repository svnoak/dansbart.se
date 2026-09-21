package se.dansbart.domain.group;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupSummaryDto;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/groups", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Groups", description = "User groups that can jointly own playlists")
public class GroupController {

    private final GroupService groupService;

    @GetMapping
    @Operation(summary = "Get groups the current user belongs to")
    public ResponseEntity<List<GroupSummaryDto>> getMyGroups(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(groupService.findMyGroups(userId));
    }

    @GetMapping("/public")
    @Operation(summary = "Get public groups")
    public ResponseEntity<List<GroupSummaryDto>> getPublicGroups() {
        return ResponseEntity.ok(groupService.findPublicGroups());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get group by ID")
    public ResponseEntity<GroupDto> getGroup(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return groupService.findByIdAsDto(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create a new group")
    public ResponseEntity<GroupDto> createGroup(
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateGroupRequest request) {
        GroupDto group = groupService.create(userId, request.name(), request.aboutUs(), request.isPublic());
        return ResponseEntity.created(URI.create("/api/groups/" + group.getId())).body(group);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a group's name, about-us text or visibility")
    public ResponseEntity<GroupDto> updateGroup(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateGroupRequest request) {
        return ResponseEntity.ok(groupService.update(id, userId, request.name(), request.aboutUs(), request.isPublic()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a group")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        groupService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    public record CreateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
    public record UpdateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
}
