package se.dansbart.domain.track;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "track_style_votes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackStyleVote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @Column(name = "voter_id", nullable = false)
    private String voterId;

    @Column(name = "suggested_style")
    private String suggestedStyle;

    @Column(name = "tempo_correction")
    private String tempoCorrection;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}
