package se.dansbart.domain.user;

import lombok.*;
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
    private String userId;

    @Builder.Default
    private String permission = "view";

    @Builder.Default
    private String status = "pending";

    private String invitedBy;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;

    private Playlist playlist;
    private User user;
}
