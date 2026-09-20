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
    private String shareToken;
    private String danceStyle;
    private String subStyle;
    private String tempoCategory;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    // Owner info — exactly one of owner/ownerGroup is set, mirroring Playlist.userId/groupId.
    private UserSummaryDto owner;
    private GroupSummaryDto ownerGroup;

    // Track count
    private Integer trackCount;

    // Tracks in this playlist (with position)
    private List<PlaylistTrackDto> tracks;

    // Collaborators (includes permission + status for role-aware UI)
    private List<CollaboratorDto> collaborators;

    /** True if the requesting user has full (owner-equivalent) control: the direct
     *  owner, or — for a group-owned playlist — an admin or canManagePlaylists member
     *  of the owning group. Null when the playlist was fetched without a viewer
     *  (e.g. by share token). */
    private Boolean viewerCanManage;
}
