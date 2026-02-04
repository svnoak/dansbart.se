package se.dansbart.domain.admin;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "pending_artist_approvals",
       uniqueConstraints = @UniqueConstraint(name = "unique_pending_artist", columnNames = {"spotify_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingArtistApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "spotify_id", nullable = false)
    private String spotifyId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "discovered_at", insertable = false, updatable = false)
    private OffsetDateTime discoveredAt;

    @Column(name = "discovery_source", nullable = false)
    private String discoverySource;

    @Type(JsonType.class)
    @Column(name = "detected_genres", columnDefinition = "jsonb")
    private List<String> detectedGenres;

    @Column(name = "music_genre_classification")
    private String musicGenreClassification;

    @Column(name = "genre_confidence")
    private Float genreConfidence;

    @Column(name = "status")
    @Builder.Default
    private String status = "pending";

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Type(JsonType.class)
    @Column(name = "additional_data", columnDefinition = "jsonb")
    private Map<String, Object> additionalData;
}
