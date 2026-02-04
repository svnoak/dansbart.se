package se.dansbart.domain.admin;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "genre_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenreProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "genre_name", unique = true, nullable = false)
    private String genreName;

    @Column(name = "avg_note_density", nullable = false)
    private Float avgNoteDensity;

    @Type(JsonType.class)
    @Column(name = "common_meters", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> commonMeters;

    @Type(JsonType.class)
    @Column(name = "rhythm_patterns", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> rhythmPatterns;

    @Column(name = "sample_size", nullable = false)
    private Integer sampleSize;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;
}
