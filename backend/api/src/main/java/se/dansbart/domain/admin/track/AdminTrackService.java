package se.dansbart.domain.admin.track;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogRepository;
import se.dansbart.domain.track.*;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminTrackService {

    private final TrackRepository trackRepository;
    private final RejectionLogRepository rejectionLogRepository;
    private final TrackFeedbackService feedbackService;
    private final TaskDispatcher taskDispatcher;

    @Transactional(readOnly = true)
    public Page<Track> getTracks(String search, String status, Boolean flagged, int limit, int offset) {
        // For simplicity, returning all tracks with pagination
        // In production, you'd add filtering logic
        return trackRepository.findAll(PageRequest.of(offset / limit, limit));
    }

    @Transactional
    public Map<String, Object> triggerReanalysis(UUID trackId) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        Track track = trackOpt.get();
        track.setProcessingStatus("PENDING");
        trackRepository.save(track);

        // Queue analysis task
        taskDispatcher.dispatchAudioAnalysis(trackId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Re-analysis queued for: " + track.getTitle());
        return result;
    }

    @Transactional
    public Map<String, Object> triggerBulkReanalysis(String statusFilter, int limit) {
        List<Track> tracks;

        if ("everything".equals(statusFilter)) {
            tracks = trackRepository.findAll().stream().limit(limit).toList();
        } else if ("all".equals(statusFilter)) {
            tracks = trackRepository.findAll().stream()
                .filter(t -> !"DONE".equals(t.getProcessingStatus()))
                .limit(limit)
                .toList();
        } else {
            tracks = trackRepository.findAll().stream()
                .filter(t -> statusFilter.equals(t.getProcessingStatus()))
                .limit(limit)
                .toList();
        }

        if (tracks.isEmpty()) {
            return Map.of(
                "status", "success",
                "message", "No tracks found with status: " + statusFilter,
                "queued", 0
            );
        }

        List<Map<String, String>> queuedTracks = new ArrayList<>();
        for (Track track : tracks) {
            track.setProcessingStatus("PENDING");
            queuedTracks.add(Map.of(
                "id", track.getId().toString(),
                "title", track.getTitle()
            ));
        }
        trackRepository.saveAll(tracks);

        // Queue all tracks
        for (Map<String, String> trackInfo : queuedTracks) {
            taskDispatcher.dispatchAudioAnalysis(UUID.fromString(trackInfo.get("id")));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Queued " + queuedTracks.size() + " tracks for re-analysis");
        result.put("queued", queuedTracks.size());
        result.put("tracks", queuedTracks);
        return result;
    }

    @Transactional
    public Map<String, Object> triggerReclassify(UUID trackId) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
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
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        trackRepository.deleteById(trackId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Track deleted successfully");
        return result;
    }

    @Transactional
    public Map<String, Object> rejectTrack(UUID trackId, String reason, boolean dryRun) {
        Optional<Track> trackOpt = trackRepository.findById(trackId);
        if (trackOpt.isEmpty()) {
            throw new IllegalArgumentException("Track not found");
        }

        Track track = trackOpt.get();

        Map<String, Object> result = new HashMap<>();
        result.put("track_id", trackId);
        result.put("track_title", track.getTitle());
        result.put("dry_run", dryRun);

        if (!dryRun) {
            // Add to rejection log if has spotify ID
            if (track.getIsrc() != null) {
                RejectionLog rejection = RejectionLog.builder()
                    .entityType("track")
                    .spotifyId(track.getIsrc())
                    .entityName(track.getTitle())
                    .reason(reason)
                    .build();
                rejectionLogRepository.save(rejection);
            }

            trackRepository.deleteById(trackId);
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
}
