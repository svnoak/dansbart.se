package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StyleKeyword {

    private UUID id;
    private String keyword;
    private String mainStyle;
    private String subStyle;

    @Builder.Default
    private Boolean isActive = true;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
