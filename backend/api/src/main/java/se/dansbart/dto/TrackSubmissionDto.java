package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One track added through a Spotify or YouTube link, as the pages show it. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackSubmissionDto {
    private UUID id;
    private UUID batchId;
    private String provider;
    private String sourceKind;
    private String sourceName;
    private String sourceUrl;
    private String externalId;
    private String title;
    private String artistName;
    private String albumName;
    private String suggestedMainStyle;
    private String suggestedSubStyle;
    /** pending, approved, rejected or exists. */
    private String status;
    private UUID trackId;
    /** The track's processing status (PENDING, PROCESSING, DONE, FAILED) once a track exists; null while the ingest worker still fetches it. */
    private String trackStatus;
    /** Username of a signed-in submitter; null for anonymous people. Only filled for admins. */
    private String submitterName;
    private OffsetDateTime createdAt;
    private OffsetDateTime reviewedAt;
    private String reviewNote;
}
