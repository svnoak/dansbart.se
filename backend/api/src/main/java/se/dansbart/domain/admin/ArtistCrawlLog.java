package se.dansbart.domain.admin;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "artist_crawl_logs",
       uniqueConstraints = @UniqueConstraint(name = "unique_spotify_artist_crawl", columnNames = {"spotify_artist_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArtistCrawlLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "spotify_artist_id", nullable = false)
    private String spotifyArtistId;

    @Column(name = "artist_name", nullable = false)
    private String artistName;

    @Column(name = "crawled_at", insertable = false, updatable = false)
    private OffsetDateTime crawledAt;

    @Column(name = "tracks_found")
    @Builder.Default
    private Integer tracksFound = 0;

    @Column(name = "status")
    @Builder.Default
    private String status = "success";

    @Type(JsonType.class)
    @Column(name = "detected_genres", columnDefinition = "jsonb")
    private List<String> detectedGenres;

    @Column(name = "music_genre_classification")
    private String musicGenreClassification;

    @Column(name = "discovery_source")
    private String discoverySource;
}
