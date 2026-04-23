package se.dansbart.domain.dance;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Dance {
    private UUID id;
    private String name;
    private String slug;
    private String danceDescriptionUrl;
    private String danstyp;
    private String musik;
    private OffsetDateTime createdAt;
}
