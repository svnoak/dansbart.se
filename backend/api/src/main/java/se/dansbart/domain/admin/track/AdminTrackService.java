package se.dansbart.domain.admin.track;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogJooqRepository;
import se.dansbart.domain.track.*;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminTrackService {

    private final TrackJooqRepository trackJooqRepository;
    private final RejectionLogJooqRepository rejectionLogJooqRepository;
    private final TrackFeedbackService feedbackService;
    private final TaskDispatcher taskDispatcher;
    private final AdminTrackJooqRepository adminTrackJooqRepository;

    @Transactional(readOnly = true)
    public Page<AdminTrackDto> getTracks(String search, String status, Boolean flagged, int limit, int offset, String sortBy, String sortDirection) {
        return adminTrackJooqRepository.findAllWithRelationships(search, status, flagged, limit, offset, sortBy, sortDirection);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStatusCounts() {
        return adminTrackJooqRepository.countByProcessingStatus();
    }

    @Transactional
    public Map<String, Object> triggerReanalysis(UUID trackId) {
        if (!trackJooqRepository.existsById(trackId)) {
            throw new IllegalArgumentException("Track not found");
        }

        trackJooqRepository.setProcessingStatus(trackId, "PENDING");
        taskDispatcher.dispatchAudioAnalysis(trackId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Re-analysis queued for track " + trackId);
        return result;
    }

    @Transactional
    public Map<String, Object> triggerBulkReanalysis(String statusFilter, int limit) {
        List<UUID> trackIds;

        if ("everything".equals(statusFilter)) {
            trackIds = trackJooqRepository.findIdsOrderByCreatedAtDesc(limit);
        } else if ("all".equals(statusFilter)) {
            trackIds = trackJooqRepository.findIdsWhereProcessingStatusNotDone(limit);
        } else {
            trackIds = trackJooqRepository.findIdsByProcessingStatusOrderByCreatedAtDesc(statusFilter, limit);
        }

        if (trackIds.isEmpty()) {
            return Map.of(
                "status", "success",
                "message", "No tracks found with status: " + statusFilter,
                "queued", 0
            );
        }

        trackJooqRepository.setProcessingStatusBatch(trackIds, "PENDING");

        List<Map<String, String>> queuedTracks = new ArrayList<>();
        List<Track> tracks = trackJooqRepository.findByIds(trackIds);
        for (Track track : tracks) {
            queuedTracks.add(Map.of(
                "id", track.getId().toString(),
                "title", track.getTitle()
            ));
        }

        for (UUID id : trackIds) {
            taskDispatcher.dispatchAudioAnalysis(id);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Queued " + trackIds.size() + " tracks for re-analysis");
        result.put("queued", trackIds.size());
        result.put("tracks", queuedTracks);
        return result;
    }

    @Transactional
    public Map<String, Object> triggerReclassify(UUID trackId) {
        Optional<Track> trackOpt = trackJooqRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        // For now, just dispatch a reclassify task
        // In production, this would trigger the feature worker
        taskDispatcher.dispatchReclassifyLibrary();

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Reclassification queued for track");
        return result;
    }

    @Transactional
    public Map<String, Object> deleteTrack(UUID trackId) {
        Optional<Track> trackOpt = trackJooqRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        trackJooqRepository.deleteById(trackId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Track deleted successfully");
        return result;
    }

    @Transactional
    public Map<String, Object> rejectTrack(UUID trackId, String reason, boolean dryRun) {
        Optional<Track> trackOpt = trackJooqRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        Track track = trackOpt.get();

        Map<String, Object> result = new HashMap<>();
        result.put("trackId", trackId);
        result.put("trackTitle", track.getTitle());
        result.put("dryRun", dryRun);

        if (!dryRun) {
            // Add to rejection log if has spotify ID
            if (track.getIsrc() != null) {
                RejectionLog rejection = RejectionLog.builder()
                    .entityType("track")
                    .spotifyId(track.getIsrc())
                    .entityName(track.getTitle())
                    .reason(reason)
                    .build();
                rejectionLogJooqRepository.insert(rejection);
            }

            trackJooqRepository.deleteById(trackId);
            result.put("status", "rejected");
            result.put("message", "Track rejected and deleted");
        } else {
            result.put("status", "preview");
            result.put("message", "Would reject and delete track");
        }

        return result;
    }

    @Transactional
    public Map<String, Object> resetTrackStructure(UUID trackId) {
        return feedbackService.resetTrackStructure(trackId)
            .orElseThrow(() -> new IllegalArgumentException("Track not found"));
    }

    /**
     * Remove flag from a track (admin override).
     */
    @Transactional
    public Optional<Map<String, Object>> unflagTrack(UUID trackId) {
        return feedbackService.unflagTrack(trackId);
    }

    /**
     * Directly set the primary dance style for a track (admin override).
     * Sets is_user_confirmed = true since this is an explicit admin correction.
     */
    @Transactional
    public Map<String, Object> updateDanceStyle(UUID trackId, String danceStyle, String subStyle, String tempoCategory) {
        if (!trackJooqRepository.existsById(trackId)) {
            throw new IllegalArgumentException("Track not found");
        }

        adminTrackJooqRepository.updatePrimaryDanceStyle(trackId, danceStyle, subStyle, tempoCategory);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("trackId", trackId.toString());
        result.put("danceStyle", danceStyle);
        result.put("subStyle", subStyle);
        result.put("tempoCategory", tempoCategory);
        return result;
    }
}
