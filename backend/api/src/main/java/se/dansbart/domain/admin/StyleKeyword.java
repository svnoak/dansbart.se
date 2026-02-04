package se.dansbart.domain.admin;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "style_keywords",
       uniqueConstraints = @UniqueConstraint(name = "unique_keyword", columnNames = {"keyword"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StyleKeyword {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "keyword", nullable = false)
    private String keyword;

    @Column(name = "main_style", nullable = false)
    private String mainStyle;

    @Column(name = "sub_style")
    private String subStyle;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
