package se.dansbart.domain.admin.spider;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.ArtistCrawlLog;
import se.dansbart.domain.admin.ArtistCrawlLogRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminSpiderService {

    private final ArtistCrawlLogRepository crawlLogRepository;
    private final TaskDispatcher taskDispatcher;

    /**
     * Trigger spider crawl.
     */
    public Map<String, Object> triggerSpiderCrawl(String mode, int maxDiscoveries, boolean discoverFromAlbums) {
        // Dispatch the spider crawl task
        taskDispatcher.dispatchSpiderCrawl(null);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("message", "Spider crawl queued in background (" + mode + " mode)");
        result.put("task_id", UUID.randomUUID().toString());
        result.put("mode", mode);
        result.put("parameters", Map.of(
            "max_discoveries", maxDiscoveries,
            "discover_from_albums", discoverFromAlbums
        ));
        return result;
    }

    /**
     * Get crawl history.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getCrawlHistory(int limit, int offset) {
        Page<ArtistCrawlLog> page = crawlLogRepository.findAllByOrderByCrawledAtDesc(
            PageRequest.of(offset / limit, limit)
        );

        List<Map<String, Object>> items = page.getContent().stream()
            .map(log -> {
                Map<String, Object> item = new HashMap<>();
                item.put("id", log.getId().toString());
                item.put("artist_name", log.getArtistName());
                item.put("spotify_id", log.getSpotifyArtistId());
                item.put("tracks_found", log.getTracksFound());
                item.put("music_genre", log.getMusicGenreClassification());
                item.put("detected_genres", log.getDetectedGenres());
                item.put("status", log.getStatus());
                item.put("discovery_source", log.getDiscoverySource());
                item.put("crawled_at", log.getCrawledAt() != null ? log.getCrawledAt().toString() : null);
                return item;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    /**
     * Get spider statistics.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getSpiderStats() {
        long totalCrawled = crawlLogRepository.count();
        Long totalTracks = crawlLogRepository.sumTracksFound();

        Map<String, Long> byGenre = new HashMap<>();
        for (Object[] row : crawlLogRepository.countByMusicGenre()) {
            if (row[0] != null) {
                byGenre.put((String) row[0], (Long) row[1]);
            }
        }

        Map<String, Long> byStatus = new HashMap<>();
        for (Object[] row : crawlLogRepository.countByStatus()) {
            byStatus.put((String) row[0], (Long) row[1]);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total_artists_crawled", totalCrawled);
        result.put("total_tracks_found", totalTracks != null ? totalTracks : 0);
        result.put("by_genre", byGenre);
        result.put("by_status", byStatus);
        return result;
    }
}
