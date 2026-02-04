package se.dansbart.domain.track;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.domain.user.User;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "tracks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Track {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "isrc")
    private String isrc;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    // Audio Features
    @Column(name = "has_vocals")
    private Boolean hasVocals;

    @Column(name = "swing_ratio")
    private Float swingRatio;

    @Column(name = "articulation")
    private Float articulation;

    @Column(name = "bounciness")
    private Float bounciness;

    @Column(name = "loudness")
    private Float loudness;

    @Column(name = "punchiness")
    private Float punchiness;

    @Column(name = "voice_probability")
    private Float voiceProbability;

    @Column(name = "polska_score")
    private Float polskaScore;

    @Column(name = "hambo_score")
    private Float hamboScore;

    @Column(name = "bpm_stability")
    private Float bpmStability;

    // Vector embedding (stored as float array, pgvector handles conversion)
    @Column(name = "embedding", columnDefinition = "vector")
    private float[] embedding;

    @Column(name = "analysis_version")
    private String analysisVersion;

    // Music Genre Classification
    @Column(name = "music_genre")
    private String musicGenre;

    @Column(name = "genre_confidence")
    private Float genreConfidence;

    // User Flagging System
    @Column(name = "is_flagged")
    @Builder.Default
    private Boolean isFlagged = false;

    @Column(name = "flagged_at")
    private OffsetDateTime flaggedAt;

    @Column(name = "flag_reason")
    private String flagReason;

    // User Upload
    @Column(name = "uploader_id", length = 255)
    private String uploaderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploader_id", insertable = false, updatable = false)
    private User uploader;

    // Processing Status
    @Column(name = "processing_status")
    @Builder.Default
    private String processingStatus = "PENDING";

    // Structure Data (JSONB)
    @Type(JsonType.class)
    @Column(name = "bars", columnDefinition = "jsonb")
    private List<Float> bars;

    @Type(JsonType.class)
    @Column(name = "sections", columnDefinition = "jsonb")
    private List<Float> sections;

    @Type(JsonType.class)
    @Column(name = "section_labels", columnDefinition = "jsonb")
    private List<String> sectionLabels;

    // Relationships
    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackArtist> artistLinks = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackAlbum> albumLinks = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackDanceStyle> danceStyles = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PlaybackLink> playbackLinks = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AnalysisSource> analysisSources = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackStyleVote> styleVotes = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackFeelVote> feelVotes = new ArrayList<>();

    @OneToMany(mappedBy = "track", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackStructureVersion> structureVersions = new ArrayList<>();
}
