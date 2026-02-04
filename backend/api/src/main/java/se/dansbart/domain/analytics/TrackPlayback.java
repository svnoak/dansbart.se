package se.dansbart.domain.analytics;

import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "track_playbacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackPlayback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @Column(name = "platform", nullable = false)
    private String platform;

    @Column(name = "played_at", insertable = false, updatable = false)
    private OffsetDateTime playedAt;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "completed")
    @Builder.Default
    private Boolean completed = false;

    @Column(name = "session_id")
    private String sessionId;
}
