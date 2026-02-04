package se.dansbart.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * Full Artist DTO for detail views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArtistDto {

    private UUID id;
    private String name;
    private String imageUrl;
    private String spotifyId;
    private Boolean isVerified;

    // Statistics
    private Integer trackCount;
    private Integer albumCount;

    // Related albums
    private List<AlbumSummaryDto> albums;
}
