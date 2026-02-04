package se.dansbart.domain.track;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "playback_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaybackLink {

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

    @Column(name = "deep_link", nullable = false)
    private String deepLink;

    @Column(name = "is_working")
    @Builder.Default
    private Boolean isWorking = true;
}
