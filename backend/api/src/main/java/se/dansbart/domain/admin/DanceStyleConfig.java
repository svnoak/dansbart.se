package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceStyleConfig {

    private UUID id;
    private String mainStyle;
    private String subStyle;
    private Integer beatsPerBar;

    @Builder.Default
    private Boolean isActive = true;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}