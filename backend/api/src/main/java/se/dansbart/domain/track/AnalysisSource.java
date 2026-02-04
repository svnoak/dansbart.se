package se.dansbart.domain.track;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "analysis_sources")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalysisSource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Type(JsonType.class)
    @Column(name = "raw_data", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> rawData;

    @Column(name = "confidence_score")
    @Builder.Default
    private Float confidenceScore = 1.0f;

    @Column(name = "analyzed_at", insertable = false, updatable = false)
    private OffsetDateTime analyzedAt;
}
