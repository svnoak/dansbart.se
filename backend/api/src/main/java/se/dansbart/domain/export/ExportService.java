package se.dansbart.domain.export;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.DanceMovementFeedbackRepository;
import se.dansbart.domain.track.*;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExportService {

    private final TrackRepository trackRepository;
    private final TrackStyleVoteRepository styleVoteRepository;
    private final TrackStructureVersionRepository structureVersionRepository;
    private final DanceMovementFeedbackRepository movementFeedbackRepository;
    private final TrackDanceStyleRepository danceStyleRepository;

    /**
     * Export track data for public consumption.
     * Includes audio features, classifications, but excludes proprietary platform IDs.
     */
    public Map<String, Object> exportTracks(Integer limit, int offset) {
        long totalCount = trackRepository.count();

        List<Track> tracks;
        if (limit != null) {
            tracks = trackRepository.findAll().stream()
                .skip(offset)
                .limit(limit)
                .toList();
        } else {
            tracks = trackRepository.findAll();
        }

        List<Map<String, Object>> exportedTracks = tracks.stream()
            .map(this::formatTrackExport)
            .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metadata", getExportMetadata(totalCount, limit, offset, exportedTracks.size()));
        result.put("license", getLicenseInfo());
        result.put("schema_version", "1.0.0");
        result.put("tracks", exportedTracks);

        return result;
    }

    /**
     * Export aggregated feedback data.
     */
    public Map<String, Object> exportFeedback() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metadata", Map.of(
            "export_date", OffsetDateTime.now().toString(),
            "description", "Human feedback and ground truth data from Dansbart users"
        ));
        result.put("license", getLicenseInfo());
        result.put("schema_version", "1.0.0");
        result.put("style_votes", exportStyleVotes());
        result.put("dance_movement_consensus", exportDanceMovementFeedback());
        result.put("structure_annotations", exportStructureVersions());

        return result;
    }

    /**
     * Get statistics about the exportable dataset.
     */
    public Map<String, Object> getExportStats() {
        long totalTracks = trackRepository.count();
        long tracksWithAnalysis = trackRepository.findAll().stream()
            .filter(t -> t.getAnalysisVersion() != null)
            .count();
        long tracksWithEmbeddings = trackRepository.findAll().stream()
            .filter(t -> t.getEmbedding() != null)
            .count();

        return Map.of(
            "total_tracks", totalTracks,
            "tracks_with_analysis", tracksWithAnalysis,
            "tracks_with_embeddings", tracksWithEmbeddings,
            "total_style_votes", styleVoteRepository.count(),
            "total_structure_versions", structureVersionRepository.count(),
            "dance_styles_count", danceStyleRepository.findAllDistinctDanceStyles().size()
        );
    }

    private Map<String, Object> formatTrackExport(Track track) {
        // Get artist names
        List<String> artistNames = track.getArtistLinks().stream()
            .filter(link -> "primary".equals(link.getRole()))
            .map(link -> link.getArtist().getName())
            .toList();

        if (artistNames.isEmpty() && !track.getArtistLinks().isEmpty()) {
            artistNames = List.of(track.getArtistLinks().get(0).getArtist().getName());
        }

        // Get dance styles
        List<Map<String, Object>> danceStyles = track.getDanceStyles().stream()
            .map(ds -> {
                Map<String, Object> style = new LinkedHashMap<>();
                style.put("dance_style", ds.getDanceStyle());
                style.put("sub_style", ds.getSubStyle());
                style.put("is_primary", ds.getIsPrimary());
                style.put("confidence", ds.getConfidence());
                style.put("tempo_category", ds.getTempoCategory());
                style.put("bpm_multiplier", ds.getBpmMultiplier());
                style.put("effective_bpm", ds.getEffectiveBpm());
                style.put("confirmation_count", ds.getConfirmationCount());
                style.put("is_user_confirmed", ds.getIsUserConfirmed());
                return style;
            })
            .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isrc", track.getIsrc());
        result.put("title", track.getTitle());
        result.put("artist_names", artistNames);
        result.put("duration_ms", track.getDurationMs());
        result.put("created_at", track.getCreatedAt() != null ? track.getCreatedAt().toString() : null);

        // Audio features
        Map<String, Object> audioFeatures = new LinkedHashMap<>();
        audioFeatures.put("has_vocals", track.getHasVocals());
        audioFeatures.put("swing_ratio", track.getSwingRatio());
        audioFeatures.put("articulation", track.getArticulation());
        audioFeatures.put("bounciness", track.getBounciness());
        audioFeatures.put("loudness", track.getLoudness());
        audioFeatures.put("punchiness", track.getPunchiness());
        audioFeatures.put("voice_probability", track.getVoiceProbability());
        audioFeatures.put("polska_score", track.getPolskaScore());
        audioFeatures.put("hambo_score", track.getHamboScore());
        audioFeatures.put("bpm_stability", track.getBpmStability());
        result.put("audio_features", audioFeatures);

        result.put("analysis_version", track.getAnalysisVersion());

        // Convert embedding
        if (track.getEmbedding() != null) {
            List<Float> embedding = new ArrayList<>();
            for (float f : track.getEmbedding()) {
                embedding.add(f);
            }
            result.put("embedding", embedding);
        } else {
            result.put("embedding", null);
        }

        result.put("music_genre", track.getMusicGenre());
        result.put("genre_confidence", track.getGenreConfidence());
        result.put("dance_styles", danceStyles);

        // Structure
        Map<String, Object> structure = new LinkedHashMap<>();
        structure.put("bars", track.getBars());
        structure.put("sections", track.getSections());
        structure.put("section_labels", track.getSectionLabels());
        result.put("structure", structure);

        result.put("is_flagged", track.getIsFlagged());
        result.put("flag_reason", Boolean.TRUE.equals(track.getIsFlagged()) ? track.getFlagReason() : null);

        return result;
    }

    private List<Map<String, Object>> exportStyleVotes() {
        return styleVoteRepository.findAll().stream()
            .map(vote -> {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("track_id", vote.getTrackId());
                v.put("suggested_style", vote.getSuggestedStyle());
                v.put("tempo_correction", vote.getTempoCorrection());
                v.put("created_at", vote.getCreatedAt() != null ? vote.getCreatedAt().toString() : null);
                return v;
            })
            .toList();
    }

    private List<Map<String, Object>> exportDanceMovementFeedback() {
        return movementFeedbackRepository.findAll().stream()
            .map(f -> {
                Map<String, Object> feedback = new LinkedHashMap<>();
                feedback.put("dance_style", f.getDanceStyle());
                feedback.put("movement_tag", f.getMovementTag());
                feedback.put("score", f.getScore());
                feedback.put("occurrences", f.getOccurrences());
                return feedback;
            })
            .toList();
    }

    private List<Map<String, Object>> exportStructureVersions() {
        return structureVersionRepository.findAll().stream()
            .filter(v -> !Boolean.TRUE.equals(v.getIsHidden()))
            .map(v -> {
                Map<String, Object> version = new LinkedHashMap<>();
                version.put("track_id", v.getTrackId());
                version.put("description", v.getDescription());
                version.put("structure_data", v.getStructureData());
                version.put("vote_count", v.getVoteCount());
                version.put("is_active", v.getIsActive());
                version.put("created_at", v.getCreatedAt() != null ? v.getCreatedAt().toString() : null);
                version.put("author_alias", v.getAuthorAlias());
                return version;
            })
            .toList();
    }

    private Map<String, Object> getExportMetadata(long totalCount, Integer limit, int offset, int exportedCount) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("export_date", OffsetDateTime.now().toString());
        metadata.put("description", "Dansbart.se music analysis dataset - Audio features, classifications, and human feedback");
        metadata.put("total_tracks_available", totalCount);
        metadata.put("tracks_in_export", exportedCount);
        metadata.put("offset", offset);
        metadata.put("source", "https://dansbart.se");
        metadata.put("analysis_engine", "neckenml-analyzer");
        return metadata;
    }

    private Map<String, Object> getLicenseInfo() {
        Map<String, Object> license = new LinkedHashMap<>();
        license.put("license", "CC BY 4.0");
        license.put("license_url", "https://creativecommons.org/licenses/by/4.0/");
        license.put("attribution", "Dansbart.se - Swedish Folk Dance Music Analysis Dataset");
        license.put("attribution_url", "https://dansbart.se");
        license.put("notice", "This dataset includes audio analysis generated by neckenml-analyzer and human-validated ground truth data.");
        license.put("data_includes", List.of(
            "Audio analysis features from neckenml-analyzer",
            "Dance style classifications with confidence scores",
            "Human feedback and corrections",
            "Track structure annotations",
            "Genre classifications",
            "Public metadata (ISRC, title, artist name, duration)"
        ));
        return license;
    }
}
