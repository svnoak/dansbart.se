package se.dansbart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(name = "Dance", description = "Dance entry with link to description and track count")
public class DanceDto {

    @Schema(description = "Unique identifier")
    private UUID id;

    @Schema(description = "Display name of the dance", example = "Hambo")
    private String name;

    @Schema(description = "URL-safe slug derived from the name", example = "hambo")
    private String slug;

    @Schema(description = "Link to the external dance description page")
    private String danceDescriptionUrl;

    @Schema(description = "Dance category from (e.g. Hambo, Vals, Polka)", example = "Hambo")
    private String danceType;

    @Schema(description = "Tune/track name description (e.g. Lugn hambo)", example = "Lugn hambo")
    private String music;

    @Schema(description = "Number of confirmed tracks linked to this dance")
    private long confirmedTrackCount;
}
