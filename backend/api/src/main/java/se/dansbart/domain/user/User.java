package se.dansbart.domain.user;

import lombok.*;
import se.dansbart.domain.playlist.Playlist;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    private String id;
    private String username;
    private String displayName;
    private String avatarUrl;
    private OffsetDateTime createdAt;
    private OffsetDateTime lastLoginAt;

    @Builder.Default
    private List<Playlist> playlists = new ArrayList<>();

    @Builder.Default
    private List<PlaylistCollaborator> collaborations = new ArrayList<>();
}
