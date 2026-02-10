package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingArtistApproval {

    private UUID id;
    private String spotifyId;
    private String name;
    private String imageUrl;
    private OffsetDateTime discoveredAt;
    private String discoverySource;
    private List<String> detectedGenres;
    private String musicGenreClassification;
    private Float genreConfidence;

    @Builder.Default
    private String status = "pending";

    private OffsetDateTime reviewedAt;
    private Map<String, Object> additionalData;
}
