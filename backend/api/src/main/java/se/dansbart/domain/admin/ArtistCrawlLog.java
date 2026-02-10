package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArtistCrawlLog {

    private UUID id;
    private String spotifyArtistId;
    private String artistName;
    private OffsetDateTime crawledAt;

    @Builder.Default
    private Integer tracksFound = 0;

    @Builder.Default
    private String status = "success";

    private List<String> detectedGenres;
    private String musicGenreClassification;
    private String discoverySource;
}
