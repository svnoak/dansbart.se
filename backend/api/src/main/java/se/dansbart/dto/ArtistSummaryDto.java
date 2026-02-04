package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * Minimal Artist DTO for embedding in other responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArtistSummaryDto {

    private UUID id;
    private String name;
    private String imageUrl;
    private String role; // "primary" or "featured"
}
