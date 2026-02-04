package se.dansbart.domain.admin.duplicates;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DuplicateMergerService {

    private final TrackRepository trackRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getDuplicateTracks(int limit, int offset) {
        // Find ISRCs that have multiple tracks
        List<Object[]> duplicateIsrcs = trackRepository.findDuplicateIsrcs(limit, offset);

        List<Map<String, Object>> groups = new ArrayList<>();
        for (Object[] row : duplicateIsrcs) {
            String isrc = (String) row[0];
            long count = ((Number) row[1]).longValue();

            List<Track> tracks = trackRepository.findByIsrc(isrc);
            List<Map<String, Object>> trackList = tracks.stream()
                .map(t -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", t.getId().toString());
                    m.put("title", t.getTitle());
                    m.put("status", t.getProcessingStatus());
                    m.put("created_at", t.getCreatedAt() != null ? t.getCreatedAt().toString() : null);
                    return m;
                })
                .toList();

            Map<String, Object> group = new HashMap<>();
            group.put("isrc", isrc);
            group.put("count", count);
            group.put("tracks", trackList);
            groups.add(group);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("groups", groups);
        result.put("total_groups", groups.size());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findMergeableDuplicates(int limit) {
        List<Object[]> duplicates = trackRepository.findDuplicateIsrcs(limit, 0);

        List<Map<String, Object>> mergeables = new ArrayList<>();
        for (Object[] row : duplicates) {
            String isrc = (String) row[0];
            long count = ((Number) row[1]).longValue();

            mergeables.add(Map.of(
                "isrc", isrc,
                "count", count
            ));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("mergeable_isrcs", mergeables);
        result.put("total", mergeables.size());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDuplicateAnalysis(String isrc) {
        List<Track> tracks = trackRepository.findByIsrc(isrc);

        if (tracks.isEmpty()) {
            return Map.of("error", "No tracks found with ISRC: " + isrc);
        }

        // Determine canonical track (prefer DONE status, then oldest)
        Track canonical = tracks.stream()
            .sorted(Comparator
                .comparing((Track t) -> !"DONE".equals(t.getProcessingStatus()))
                .thenComparing(Track::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .findFirst()
            .orElse(tracks.get(0));

        List<Map<String, Object>> trackDetails = tracks.stream()
            .map(t -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", t.getId().toString());
                m.put("title", t.getTitle());
                m.put("status", t.getProcessingStatus());
                m.put("is_canonical", t.getId().equals(canonical.getId()));
                m.put("created_at", t.getCreatedAt() != null ? t.getCreatedAt().toString() : null);
                return m;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("isrc", isrc);
        result.put("total_duplicates", tracks.size());
        result.put("canonical_id", canonical.getId().toString());
        result.put("tracks", trackDetails);
        return result;
    }

    @Transactional
    public Map<String, Object> mergeDuplicatesByIsrc(String isrc, boolean dryRun) {
        List<Track> tracks = trackRepository.findByIsrc(isrc);

        if (tracks.size() < 2) {
            return Map.of("message", "No duplicates to merge for ISRC: " + isrc);
        }

        // Determine canonical track (prefer DONE status, then oldest)
        Track canonical = tracks.stream()
            .sorted(Comparator
                .comparing((Track t) -> !"DONE".equals(t.getProcessingStatus()))
                .thenComparing(Track::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .findFirst()
            .orElse(tracks.get(0));

        List<Track> toDelete = tracks.stream()
            .filter(t -> !t.getId().equals(canonical.getId()))
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("isrc", isrc);
        result.put("canonical_id", canonical.getId().toString());
        result.put("duplicates_to_delete", toDelete.size());
        result.put("dry_run", dryRun);

        if (!dryRun) {
            // In a real implementation, we would migrate album links, playback links, etc.
            // For now, just delete the duplicates
            trackRepository.deleteAll(toDelete);

            result.put("status", "success");
            result.put("deleted", toDelete.size());
        }

        return result;
    }

    @Transactional
    public Map<String, Object> mergeAllDuplicates(boolean dryRun, Integer limit) {
        int maxLimit = limit != null ? limit : 1000;
        List<Object[]> duplicateIsrcs = trackRepository.findDuplicateIsrcs(maxLimit, 0);

        int totalMerged = 0;
        int totalDeleted = 0;
        List<String> mergedIsrcs = new ArrayList<>();

        for (Object[] row : duplicateIsrcs) {
            String isrc = (String) row[0];
            Map<String, Object> mergeResult = mergeDuplicatesByIsrc(isrc, dryRun);

            if (!dryRun && mergeResult.containsKey("deleted")) {
                totalDeleted += (int) mergeResult.get("deleted");
                mergedIsrcs.add(isrc);
                totalMerged++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("dry_run", dryRun);
        result.put("isrc_groups_processed", duplicateIsrcs.size());
        result.put("total_merged", totalMerged);
        result.put("total_deleted", totalDeleted);
        if (!dryRun) {
            result.put("merged_isrcs", mergedIsrcs);
        }
        return result;
    }
}
