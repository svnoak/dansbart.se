package se.dansbart.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * Full Album DTO for detail views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlbumDto {

    private UUID id;
    private String title;
    private String coverImageUrl;
    private String releaseDate;
    private String spotifyId;

    // Artist info
    private ArtistSummaryDto artist;

    // Track count
    private Integer trackCount;

    // Tracks on this album
    private List<TrackListDto> tracks;
}
