package se.dansbart.domain.admin;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "rejection_logs",
       uniqueConstraints = @UniqueConstraint(name = "unique_rejection", columnNames = {"spotify_id", "entity_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RejectionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "spotify_id", nullable = false)
    private String spotifyId;

    @Column(name = "entity_name", nullable = false)
    private String entityName;

    @Column(name = "reason")
    private String reason;

    @Column(name = "rejected_at", insertable = false, updatable = false)
    private OffsetDateTime rejectedAt;

    @Column(name = "deleted_content")
    @Builder.Default
    private Boolean deletedContent = true;

    @Type(JsonType.class)
    @Column(name = "additional_data", columnDefinition = "jsonb")
    private Map<String, Object> additionalData;
}
