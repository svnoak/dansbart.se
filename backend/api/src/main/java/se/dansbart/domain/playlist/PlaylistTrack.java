package se.dansbart.domain.playlist;

import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "playlist_tracks",
       uniqueConstraints = @UniqueConstraint(name = "unique_playlist_track", columnNames = {"playlist_id", "track_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "playlist_id", nullable = false)
    private UUID playlistId;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(name = "added_at", insertable = false, updatable = false)
    private OffsetDateTime addedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id", insertable = false, updatable = false)
    private Playlist playlist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;
}
