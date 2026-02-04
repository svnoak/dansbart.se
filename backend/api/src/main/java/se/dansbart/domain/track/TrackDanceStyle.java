package se.dansbart.domain.track;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "track_dance_styles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackDanceStyle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @Column(name = "dance_style", nullable = false)
    private String danceStyle;

    @Column(name = "sub_style")
    private String subStyle;

    @Column(name = "is_primary")
    @Builder.Default
    private Boolean isPrimary = false;

    @Column(name = "confidence")
    @Builder.Default
    private Float confidence = 0.0f;

    @Column(name = "tempo_category")
    private String tempoCategory;

    @Column(name = "bpm_multiplier")
    @Builder.Default
    private Float bpmMultiplier = 1.0f;

    @Column(name = "effective_bpm", nullable = false)
    private Integer effectiveBpm;

    @Column(name = "confirmation_count")
    @Builder.Default
    private Integer confirmationCount = 0;

    @Column(name = "is_user_confirmed")
    @Builder.Default
    private Boolean isUserConfirmed = false;
}
