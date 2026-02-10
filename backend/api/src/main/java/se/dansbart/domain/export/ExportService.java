package se.dansbart.domain.export;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.DanceMovementFeedbackJooqRepository;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.track.*;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExportService {

    private final TrackJooqRepository trackJooqRepository;
    private final TrackStyleVoteJooqRepository styleVoteRepository;
    private final TrackStructureVersionJooqRepository structureVersionRepository;
    private final DanceMovementFeedbackJooqRepository movementFeedbackRepository;
    private final TrackDanceStyleJooqRepository danceStyleRepository;
    private final ArtistJooqRepository artistJooqRepository;

    /**
     * Export track data for public consumption.
     * Includes audio features, classifications, but excludes proprietary platform IDs.
     */
    public Map<String, Object> exportTracks(Integer limit, int offset) {
        long totalCount = trackJooqRepository.countTracks();

        int effectiveLimit = limit != null ? limit : Integer.MAX_VALUE;
        List<Track> tracks = trackJooqRepository.findAllOrderByCreatedAt(effectiveLimit, offset);

        List<Map<String, Object>> exportedTracks = tracks.stream()
            .map(this::formatTrackExport)
            .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metadata", getExportMetadata(totalCount, limit, offset, exportedTracks.size()));
        result.put("license", getLicenseInfo());
        result.put("schemaVersion", "1.0.0");
        result.put("tracks", exportedTracks);

        return result;
    }

    /**
     * Export aggregated feedback data.
     */
    public Map<String, Object> exportFeedback() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metadata", Map.of(
            "exportDate", OffsetDateTime.now().toString(),
            "description", "Human feedback and ground truth data from Dansbart users"
        ));
        result.put("license", getLicenseInfo());
        result.put("schemaVersion", "1.0.0");
        result.put("styleVotes", exportStyleVotes());
        result.put("danceMovementConsensus", exportDanceMovementFeedback());
        result.put("structureAnnotations", exportStructureVersions());

        return result;
    }

    /**
     * Get statistics about the exportable dataset.
     */
    public Map<String, Object> getExportStats() {
        long totalTracks = trackJooqRepository.countTracks();
        long tracksWithAnalysis = trackJooqRepository.countTracksWithAnalysis();
        long tracksWithEmbeddings = 0; // embedding not mapped via jOOQ yet

        return Map.of(
            "totalTracks", totalTracks,
            "tracksWithAnalysis", tracksWithAnalysis,
            "tracksWithEmbeddings", tracksWithEmbeddings,
            "totalStyleVotes", styleVoteRepository.count(),
            "totalStructureVersions", structureVersionRepository.count(),
            "danceStylesCount", danceStyleRepository.findAllDistinctDanceStyles().size()
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
                style.put("danceStyle", ds.getDanceStyle());
                style.put("subStyle", ds.getSubStyle());
                style.put("isPrimary", ds.getIsPrimary());
                style.put("confidence", ds.getConfidence());
                style.put("tempoCategory", ds.getTempoCategory());
                style.put("bpmMultiplier", ds.getBpmMultiplier());
                style.put("effectiveBpm", ds.getEffectiveBpm());
                style.put("confirmationCount", ds.getConfirmationCount());
                style.put("isUserConfirmed", ds.getIsUserConfirmed());
                return style;
            })
            .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isrc", track.getIsrc());
        result.put("title", track.getTitle());
        result.put("artistNames", artistNames);
        result.put("durationMs", track.getDurationMs());
        result.put("createdAt", track.getCreatedAt() != null ? track.getCreatedAt().toString() : null);

        // Audio features
        Map<String, Object> audioFeatures = new LinkedHashMap<>();
        audioFeatures.put("hasVocals", track.getHasVocals());
        audioFeatures.put("swingRatio", track.getSwingRatio());
        audioFeatures.put("articulation", track.getArticulation());
        audioFeatures.put("bounciness", track.getBounciness());
        audioFeatures.put("loudness", track.getLoudness());
        audioFeatures.put("punchiness", track.getPunchiness());
        audioFeatures.put("voiceProbability", track.getVoiceProbability());
        audioFeatures.put("polskaScore", track.getPolskaScore());
        audioFeatures.put("hamboScore", track.getHamboScore());
        audioFeatures.put("bpmStability", track.getBpmStability());
        result.put("audioFeatures", audioFeatures);

        result.put("analysisVersion", track.getAnalysisVersion());

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

        result.put("musicGenre", track.getMusicGenre());
        result.put("genreConfidence", track.getGenreConfidence());
        result.put("danceStyles", danceStyles);

        // Structure
        Map<String, Object> structure = new LinkedHashMap<>();
        structure.put("bars", track.getBars());
        structure.put("sections", track.getSections());
        structure.put("sectionLabels", track.getSectionLabels());
        result.put("structure", structure);

        result.put("isFlagged", track.getIsFlagged());
        result.put("flagReason", Boolean.TRUE.equals(track.getIsFlagged()) ? track.getFlagReason() : null);

        return result;
    }

    private List<Map<String, Object>> exportStyleVotes() {
        return styleVoteRepository.findAll().stream()
            .map(vote -> {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("trackId", vote.getTrackId());
                v.put("suggestedStyle", vote.getSuggestedStyle());
                v.put("tempoCorrection", vote.getTempoCorrection());
                v.put("createdAt", vote.getCreatedAt() != null ? vote.getCreatedAt().toString() : null);
                return v;
            })
            .toList();
    }

    private List<Map<String, Object>> exportDanceMovementFeedback() {
        return movementFeedbackRepository.findAll().stream()
            .map(f -> {
                Map<String, Object> feedback = new LinkedHashMap<>();
                feedback.put("danceStyle", f.getDanceStyle());
                feedback.put("movementTag", f.getMovementTag());
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
                version.put("trackId", v.getTrackId());
                version.put("description", v.getDescription());
                version.put("structureData", v.getStructureData());
                version.put("voteCount", v.getVoteCount());
                version.put("isActive", v.getIsActive());
                version.put("createdAt", v.getCreatedAt() != null ? v.getCreatedAt().toString() : null);
                version.put("authorAlias", v.getAuthorAlias());
                return version;
            })
            .toList();
    }

    private Map<String, Object> getExportMetadata(long totalCount, Integer limit, int offset, int exportedCount) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("exportDate", OffsetDateTime.now().toString());
        metadata.put("description", "Dansbart.se music analysis dataset - Audio features, classifications, and human feedback");
        metadata.put("totalTracksAvailable", totalCount);
        metadata.put("tracksInExport", exportedCount);
        metadata.put("offset", offset);
        metadata.put("source", "https://dansbart.se");
        metadata.put("analysis_engine", "neckenml-analyzer");
        return metadata;
    }

    private Map<String, Object> getLicenseInfo() {
        Map<String, Object> license = new LinkedHashMap<>();
        license.put("license", "CC BY 4.0");
        license.put("licenseUrl", "https://creativecommons.org/licenses/by/4.0/");
        license.put("attribution", "Dansbart.se - Swedish Folk Dance Music Analysis Dataset");
        license.put("attributionUrl", "https://dansbart.se");
        license.put("notice", "This dataset includes audio analysis generated by neckenml-analyzer and human-validated ground truth data.");
        license.put("dataIncludes", List.of(
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
