package se.dansbart.domain.artist;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.util.UUID;

@Entity
@Table(name = "track_artists",
       uniqueConstraints = @UniqueConstraint(name = "unique_track_artist", columnNames = {"track_id", "artist_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackArtist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @Column(name = "artist_id", nullable = false)
    private UUID artistId;

    @Column(name = "role")
    @Builder.Default
    private String role = "primary";

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id", insertable = false, updatable = false)
    private Artist artist;
}
