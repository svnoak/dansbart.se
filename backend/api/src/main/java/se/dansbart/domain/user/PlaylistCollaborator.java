package se.dansbart.domain.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.playlist.Playlist;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistCollaborator {

    private UUID id;
    private UUID playlistId;
    private UUID userId;
    private UUID groupId;

    @Builder.Default
    private String permission = "view";

    @Builder.Default
    private String status = "pending";

    private UUID invitedBy;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;

    private Playlist playlist;
    private User user;

    @JsonIgnore
    private Group group;
}
