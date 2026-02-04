package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Full Playlist DTO for detail views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistDto {

    private UUID id;
    private String name;
    private String description;
    private Boolean isPublic;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    // Owner info
    private UserSummaryDto owner;

    // Track count
    private Integer trackCount;

    // Tracks in this playlist (with position)
    private List<PlaylistTrackDto> tracks;

    // Collaborators
    private List<UserSummaryDto> collaborators;
}
