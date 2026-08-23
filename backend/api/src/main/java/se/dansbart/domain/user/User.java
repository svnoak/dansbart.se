package se.dansbart.domain.user;

import lombok.*;
import se.dansbart.domain.playlist.Playlist;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    private UUID id;
    private String discourseId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String role;
    private OffsetDateTime createdAt;
    private OffsetDateTime lastLoginAt;

    /** Distinct tracks this user has helped confirm the style of (private — shown only
     *  to the user themselves via GET /api/users/me, not a public/leaderboard stat).
     *  Populated only by UserController.getCurrentUser; left at its default (0) by
     *  every other endpoint that returns a User, since it's meaningless there. */
    @Builder.Default
    private long confirmedTrackCount = 0;

    @Builder.Default
    private List<Playlist> playlists = new ArrayList<>();

    @Builder.Default
    private List<PlaylistCollaborator> collaborations = new ArrayList<>();
}
