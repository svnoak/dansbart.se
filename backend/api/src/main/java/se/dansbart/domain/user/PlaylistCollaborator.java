package se.dansbart.domain.user;

import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.playlist.Playlist;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "playlist_collaborators",
       uniqueConstraints = @UniqueConstraint(name = "unique_playlist_collaborator", columnNames = {"playlist_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistCollaborator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "playlist_id", nullable = false)
    private UUID playlistId;

    @Column(name = "user_id", nullable = false, length = 255)
    private String userId;

    @Column(name = "permission")
    @Builder.Default
    private String permission = "view";

    @Column(name = "status")
    @Builder.Default
    private String status = "pending";

    @Column(name = "invited_by", length = 255)
    private String invitedBy;

    @Column(name = "invited_at", insertable = false, updatable = false)
    private OffsetDateTime invitedAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id", insertable = false, updatable = false)
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;
}
