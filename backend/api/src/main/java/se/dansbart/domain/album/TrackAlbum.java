package se.dansbart.domain.album;

import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.util.UUID;

@Entity
@Table(name = "track_albums",
       uniqueConstraints = @UniqueConstraint(name = "unique_track_album", columnNames = {"track_id", "album_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackAlbum {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @Column(name = "album_id", nullable = false)
    private UUID albumId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "album_id", insertable = false, updatable = false)
    private Album album;
}
