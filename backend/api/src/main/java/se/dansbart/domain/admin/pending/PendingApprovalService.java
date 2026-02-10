package se.dansbart.domain.admin.pending;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.PendingArtistApproval;
import se.dansbart.domain.admin.PendingArtistApprovalJooqRepository;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PendingApprovalService {

    private final PendingArtistApprovalJooqRepository pendingRepository;
    private final RejectionLogJooqRepository rejectionLogJooqRepository;
    private final TaskDispatcher taskDispatcher;

    @Transactional(readOnly = true)
    public Map<String, Object> getPendingArtistsForApproval(int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<PendingArtistApproval> page = pendingRepository.findByStatusOrderByDiscoveredAtDesc("pending", pageable);

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapPendingArtist)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private Map<String, Object> mapPendingArtist(PendingArtistApproval pending) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", pending.getId().toString());
        item.put("spotifyId", pending.getSpotifyId());
        item.put("name", pending.getName());
        item.put("imageUrl", pending.getImageUrl());
        item.put("discoverySource", pending.getDiscoverySource());
        item.put("detectedGenres", pending.getDetectedGenres());
        item.put("musicGenreClassification", pending.getMusicGenreClassification());
        item.put("genreConfidence", pending.getGenreConfidence());
        item.put("status", pending.getStatus());
        item.put("discoveredAt", pending.getDiscoveredAt() != null ? pending.getDiscoveredAt().toString() : null);
        return item;
    }

    @Transactional
    public Map<String, Object> approvePendingArtist(UUID id) {
        PendingArtistApproval pending = pendingRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Pending artist not found"));

        if (!"pending".equals(pending.getStatus())) {
            throw new IllegalArgumentException("Artist already processed");
        }

        // Update status
        pending.setStatus("approved");
        pending.setReviewedAt(OffsetDateTime.now());
        pendingRepository.save(pending);

        // Dispatch ingestion task for the artist (light worker expects Spotify ID)
        taskDispatcher.dispatchBackfillArtist(pending.getSpotifyId());

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Artist approved and queued for ingestion");
        result.put("artistId", id.toString());
        result.put("artistName", pending.getName());
        return result;
    }

    @Transactional
    public Map<String, Object> rejectPendingArtist(UUID id, String reason) {
        PendingArtistApproval pending = pendingRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Pending artist not found"));

        // Update status
        pending.setStatus("rejected");
        pending.setReviewedAt(OffsetDateTime.now());
        pendingRepository.save(pending);

        // Add to blocklist
        RejectionLog rejection = RejectionLog.builder()
            .entityType("artist")
            .spotifyId(pending.getSpotifyId())
            .entityName(pending.getName())
            .reason(reason)
            .deletedContent(false)
            .build();
        rejectionLogJooqRepository.insert(rejection);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("message", "Artist rejected and added to blocklist");
        result.put("artistId", id.toString());
        result.put("artistName", pending.getName());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPendingArtists(String search, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<PendingArtistApproval> page;

        if (search != null && !search.isBlank()) {
            page = pendingRepository.searchByNameAndStatus(search, "pending", pageable);
        } else {
            page = pendingRepository.findByStatusOrderByDiscoveredAtDesc("pending", pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapPendingArtist)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }
}
