package se.dansbart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(name = "Artist", description = "Artist detail view used in public APIs")
public class ArtistDto {

    @Schema(description = "Unique identifier of the artist", example = "3f7a7b2e-4b9c-4b1d-9b9e-2a6c9e2d1f3a")
    private UUID id;

    @Schema(description = "Display name of the artist", example = "Björn Ståbi")
    private String name;

    @Schema(description = "URL to artist image (if available)")
    private String imageUrl;

    @Schema(description = "Spotify artist ID", example = "1Xyo4u8uXC1ZmMpatF05PJ")
    private String spotifyId;

    @Schema(description = "Whether the artist has been manually verified")
    private Boolean isVerified;

    @Schema(description = "Admin-provided description, supports markdown")
    private String description;

    // Statistics
    @Schema(description = "Number of tracks associated with this artist")
    private Integer trackCount;

    @Schema(description = "Number of albums associated with this artist")
    private Integer albumCount;

    // Related albums
    @Schema(description = "Albums linked to this artist")
    private List<AlbumSummaryDto> albums;
}
