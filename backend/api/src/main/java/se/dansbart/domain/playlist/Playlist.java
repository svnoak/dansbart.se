package se.dansbart.domain.playlist;

import lombok.*;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.PlaylistCollaborator;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Playlist {

    private UUID id;
    private String name;
    private String description;
    private String userId;
    private User user;

    @Builder.Default
    private Boolean isPublic = false;

    private String shareToken;
    private String danceStyle;
    private String subStyle;
    private String tempoCategory;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    @Builder.Default
    private List<PlaylistTrack> tracks = new ArrayList<>();

    @Builder.Default
    private List<PlaylistCollaborator> collaborators = new ArrayList<>();
}
