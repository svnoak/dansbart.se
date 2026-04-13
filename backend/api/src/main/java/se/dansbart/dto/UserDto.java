package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Full User DTO (for own profile).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {

    private UUID id;
    private String username;
    private String displayName;
    private String avatarUrl;
    private OffsetDateTime createdAt;
    private OffsetDateTime lastLoginAt;

    // User's playlists
    private List<PlaylistSummaryDto> playlists;

    // Playlists where user is a collaborator
    private List<PlaylistSummaryDto> collaborations;
}
