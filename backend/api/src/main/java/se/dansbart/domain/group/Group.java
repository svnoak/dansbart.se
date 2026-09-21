package se.dansbart.domain.group;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group {

    private UUID id;
    private String name;
    private String aboutUs;

    @Builder.Default
    private Boolean isPublic = false;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
