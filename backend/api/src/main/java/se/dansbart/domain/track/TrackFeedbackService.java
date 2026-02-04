package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.DanceMovementFeedback;
import se.dansbart.domain.admin.DanceMovementFeedbackRepository;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrackFeedbackService {

    private final TrackStyleVoteRepository voteRepository;
    private final TrackRepository trackRepository;
    private final TrackDanceStyleRepository danceStyleRepository;
    private final TrackStructureVersionRepository structureVersionRepository;
    private final DanceMovementFeedbackRepository movementFeedbackRepository;

    @Transactional
    public Optional<TrackStyleVote> submitStyleFeedback(
            UUID trackId,
            String voterId,
            String suggestedStyle,
            String tempoCorrection) {

        if (!trackRepository.existsById(trackId)) {
            return Optional.empty();
        }

        TrackStyleVote vote = voteRepository.findByTrackIdAndVoterId(trackId, voterId)
            .map(existing -> {
                if (suggestedStyle != null) existing.setSuggestedStyle(suggestedStyle);
                if (tempoCorrection != null) existing.setTempoCorrection(tempoCorrection);
                return existing;
            })
            .orElseGet(() -> TrackStyleVote.builder()
                .trackId(trackId)
                .voterId(voterId)
                .suggestedStyle(suggestedStyle)
                .tempoCorrection(tempoCorrection)
                .build());

        return Optional.of(voteRepository.save(vote));
    }

    @Transactional(readOnly = true)
    public long getVoteCount(UUID trackId, String style) {
        return voteRepository.countByTrackIdAndSuggestedStyle(trackId, style);
    }

    /**
     * Confirm a secondary dance style for a track without affecting the primary style.
     */
    @Transactional
    public Optional<Map<String, Object>> confirmSecondaryStyle(UUID trackId, String style) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            return Optional.empty();
        }

        Optional<TrackDanceStyle> styleOpt = danceStyleRepository.findByTrackIdAndDanceStyle(trackId, style);
        if (styleOpt.isEmpty()) {
            return Optional.empty();
        }

        TrackDanceStyle danceStyle = styleOpt.get();
        danceStyle.setConfirmationCount(danceStyle.getConfirmationCount() + 1);
        danceStyleRepository.save(danceStyle);

        Map<String, Object> result = new HashMap<>();
        result.put("style", style);
        result.put("confirmationCount", danceStyle.getConfirmationCount());
        return Optional.of(result);
    }

    /**
     * Process movement feedback tags for a track's dance style.
     */
    @Transactional
    public boolean processMovementFeedback(UUID trackId, String danceStyle, List<String> tags) {
        if (!trackRepository.existsById(trackId)) {
            return false;
        }

        for (String tag : tags) {
            Optional<DanceMovementFeedback> existingOpt =
                movementFeedbackRepository.findByDanceStyleAndMovementTag(danceStyle, tag);

            if (existingOpt.isPresent()) {
                DanceMovementFeedback existing = existingOpt.get();
                existing.setOccurrences(existing.getOccurrences() + 1);
                existing.setScore((existing.getScore() * (existing.getOccurrences() - 1) + 1.0f) / existing.getOccurrences());
                movementFeedbackRepository.save(existing);
            } else {
                DanceMovementFeedback newFeedback = DanceMovementFeedback.builder()
                    .danceStyle(danceStyle)
                    .movementTag(tag)
                    .score(1.0f)
                    .occurrences(1)
                    .build();
                movementFeedbackRepository.save(newFeedback);
            }
        }
        return true;
    }

    /**
     * Flag a track as not being folk music.
     */
    @Transactional
    public Optional<Map<String, Object>> flagTrack(UUID trackId, String reason) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            return Optional.empty();
        }

        Track track = trackOpt.get();
        track.setIsFlagged(true);
        track.setFlaggedAt(OffsetDateTime.now());
        track.setFlagReason(reason != null ? reason : "not_folk_music");
        trackRepository.save(track);

        Map<String, Object> result = new HashMap<>();
        result.put("trackId", trackId);
        result.put("flagged", true);
        return Optional.of(result);
    }

    /**
     * Remove flag from a track (admin operation).
     */
    @Transactional
    public Optional<Map<String, Object>> unflagTrack(UUID trackId) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            return Optional.empty();
        }

        Track track = trackOpt.get();
        track.setIsFlagged(false);
        track.setFlaggedAt(null);
        track.setFlagReason(null);
        trackRepository.save(track);

        Map<String, Object> result = new HashMap<>();
        result.put("trackId", trackId);
        result.put("flagged", false);
        return Optional.of(result);
    }

    /**
     * Create a new structure version for a track.
     */
    @Transactional
    public Optional<TrackStructureVersion> createStructureVersion(
            UUID trackId,
            List<Float> bars,
            List<Float> sections,
            List<String> labels,
            String description,
            String authorAlias) {

        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            return Optional.empty();
        }

        Map<String, Object> structureData = new HashMap<>();
        structureData.put("bars", bars);
        structureData.put("sections", sections);
        structureData.put("labels", labels);

        // Deactivate all existing versions
        structureVersionRepository.deactivateAllForTrack(trackId);

        TrackStructureVersion version = TrackStructureVersion.builder()
            .trackId(trackId)
            .structureData(structureData)
            .description(description)
            .authorAlias(authorAlias)
            .voteCount(1)
            .isActive(true)  // New versions become active immediately
            .build();

        return Optional.of(structureVersionRepository.save(version));
    }

    /**
     * Get all structure versions for a track.
     */
    @Transactional(readOnly = true)
    public List<TrackStructureVersion> getStructureVersions(UUID trackId) {
        return structureVersionRepository.findByTrackIdOrderByActiveAndVotes(trackId);
    }

    /**
     * Vote on a structure version.
     */
    @Transactional
    public Optional<Map<String, Object>> voteOnStructure(UUID versionId, String voteType) {
        Optional<TrackStructureVersion> versionOpt = structureVersionRepository.findById(versionId);
        if (versionOpt.isEmpty()) {
            return Optional.empty();
        }

        TrackStructureVersion version = versionOpt.get();
        int delta = "up".equalsIgnoreCase(voteType) ? 1 : -1;
        version.setVoteCount(version.getVoteCount() + delta);
        structureVersionRepository.save(version);

        // Check if this version should become active (highest vote count)
        List<TrackStructureVersion> allVersions =
            structureVersionRepository.findByTrackIdOrderByActiveAndVotes(version.getTrackId());

        if (!allVersions.isEmpty() && allVersions.get(0).getId().equals(versionId) && !version.getIsActive()) {
            structureVersionRepository.deactivateAllForTrack(version.getTrackId());
            version.setIsActive(true);
            structureVersionRepository.save(version);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("versionId", versionId);
        result.put("voteCount", version.getVoteCount());
        result.put("isActive", version.getIsActive());
        return Optional.of(result);
    }

    /**
     * Report a structure version as spam/bogus.
     */
    @Transactional
    public void reportStructure(UUID versionId) {
        Optional<TrackStructureVersion> versionOpt = structureVersionRepository.findById(versionId);
        if (versionOpt.isPresent()) {
            TrackStructureVersion version = versionOpt.get();
            version.setReportCount(version.getReportCount() + 1);

            // Auto-hide if too many reports
            if (version.getReportCount() >= 3) {
                version.setIsHidden(true);
                version.setIsActive(false);
            }
            structureVersionRepository.save(version);
        }
    }

    /**
     * Reset track structure to AI defaults.
     */
    @Transactional
    public Optional<Map<String, Object>> resetTrackStructure(UUID trackId) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            return Optional.empty();
        }

        // Deactivate all user-created versions
        structureVersionRepository.deactivateAllForTrack(trackId);

        Map<String, Object> result = new HashMap<>();
        result.put("trackId", trackId);
        result.put("reset", true);
        return Optional.of(result);
    }
}
