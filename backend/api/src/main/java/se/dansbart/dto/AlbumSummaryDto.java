package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * Minimal Album DTO for embedding in other responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlbumSummaryDto {

    private UUID id;
    private String title;
    private String coverImageUrl;
    private String releaseDate;
    private Integer trackCount;
}
