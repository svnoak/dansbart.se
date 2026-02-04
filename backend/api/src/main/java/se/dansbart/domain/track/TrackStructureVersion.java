package se.dansbart.domain.track;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "track_structure_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackStructureVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "track_id", nullable = false)
    private UUID trackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", insertable = false, updatable = false)
    private Track track;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "description")
    private String description;

    @Type(JsonType.class)
    @Column(name = "structure_data", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> structureData;

    @Column(name = "vote_count")
    @Builder.Default
    private Integer voteCount = 1;

    @Column(name = "report_count")
    @Builder.Default
    private Integer reportCount = 0;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = false;

    @Column(name = "is_hidden")
    @Builder.Default
    private Boolean isHidden = false;

    @Column(name = "author_alias")
    private String authorAlias;
}
