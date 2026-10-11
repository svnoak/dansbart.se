package se.dansbart.domain.submission;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One track somebody added through a Spotify or YouTube link. See V32. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class TrackSubmission {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_APPROVED = "approved";
    public static final String STATUS_REJECTED = "rejected";
    public static final String STATUS_EXISTS = "exists";

    private UUID id;
    private UUID batchId;
    private UUID voterId;
    private UUID userId;
    private String provider;
    private String sourceKind;
    private String sourceUrl;
    private String sourceName;
    private String externalId;
    private String title;
    private String artistName;
    private String albumName;
    private String suggestedMainStyle;
    private String suggestedSubStyle;
    private String status;
    private UUID trackId;
    private UUID reviewedBy;
    private OffsetDateTime reviewedAt;
    private String reviewNote;
    private OffsetDateTime createdAt;

    /** Joined for display: the track's processing status, once a track exists. */
    private String trackProcessingStatus;
    /** Joined for display: the submitter's username, when signed in. */
    private String submitterUsername;

    public boolean isPending() {
        return STATUS_PENDING.equals(status);
    }
}
