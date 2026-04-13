package se.dansbart.domain.track;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.domain.user.User;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Track {

    private UUID id;

    private String title;

    private String isrc;

    private Integer durationMs;

    private Float tempoBpm;

    private OffsetDateTime createdAt;

    // Audio Features
    private Boolean hasVocals;

    private Float swingRatio;

    private Float articulation;

    private Float bounciness;

    private Float loudness;

    private Float punchiness;

    private Float voiceProbability;

    private Float polskaScore;

    private Float hamboScore;

    private Float bpmStability;

    private Boolean isInstrumental;

    // Vector embedding for similarity search (pgvector); not exposed to API
    @JsonIgnore
    private float[] embedding;

    private String analysisVersion;

    // Music Genre Classification
    private String musicGenre;

    private Float genreConfidence;

    // User Flagging System
    @Builder.Default
    private Boolean isFlagged = false;

    private OffsetDateTime flaggedAt;

    private String flagReason;

    // User Upload
    private UUID uploaderId;

    @JsonIgnore
    private User uploader;

    // Processing Status
    @Builder.Default
    private String processingStatus = "PENDING";

    // Structure Data (JSONB)
    private List<Float> bars;

    private List<Float> sections;

    private List<String> sectionLabels;

    // Relationships
    @JsonIgnore
    @Builder.Default
    private List<TrackArtist> artistLinks = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<TrackAlbum> albumLinks = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<TrackDanceStyle> danceStyles = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<PlaybackLink> playbackLinks = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<AnalysisSource> analysisSources = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<TrackStyleVote> styleVotes = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<TrackFeelVote> feelVotes = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<TrackStructureVersion> structureVersions = new ArrayList<>();
}
