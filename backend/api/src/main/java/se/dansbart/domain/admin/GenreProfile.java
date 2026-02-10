package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenreProfile {

    private UUID id;
    private String genreName;
    private Float avgNoteDensity;
    private Map<String, Object> commonMeters;
    private Map<String, Object> rhythmPatterns;
    private Integer sampleSize;
    private OffsetDateTime updatedAt;
}
