package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A public playlist as anyone sees it. It leaves out what only a person who manages the list
 * needs: the share token, the guest code, the collaborators and the viewer's rights.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicPlaylistDto {

    private UUID id;
    private String name;
    private String description;
    private String danceStyle;
    private String subStyle;
    private String tempoCategory;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private UserSummaryDto owner;
    private GroupSummaryDto ownerGroup;
    private Integer trackCount;
    private List<PlaylistTrackDto> tracks;
}
