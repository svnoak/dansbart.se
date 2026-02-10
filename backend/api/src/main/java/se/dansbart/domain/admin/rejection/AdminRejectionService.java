package se.dansbart.domain.admin.rejection;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogJooqRepository;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminRejectionService {

    private final RejectionLogJooqRepository rejectionLogJooqRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getRejectionsPaginated(String entityType, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<RejectionLog> page;

        if (entityType != null && !entityType.isBlank()) {
            page = rejectionLogJooqRepository.findByEntityTypeOrderByRejectedAtDesc(entityType, pageable);
        } else {
            page = rejectionLogJooqRepository.findAllByOrderByRejectedAtDesc(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapRejection)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private Map<String, Object> mapRejection(RejectionLog log) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", log.getId().toString());
        item.put("entityType", log.getEntityType());
        item.put("spotifyId", log.getSpotifyId());
        item.put("entityName", log.getEntityName());
        item.put("reason", log.getReason());
        item.put("rejectedAt", log.getRejectedAt() != null ? log.getRejectedAt().toString() : null);
        item.put("deletedContent", log.getDeletedContent());
        return item;
    }

    @Transactional
    public String removeFromBlocklist(UUID rejectionId) {
        RejectionLog log = rejectionLogJooqRepository.findById(rejectionId)
            .orElseThrow(() -> new IllegalArgumentException("Rejection not found"));

        String entityName = log.getEntityName();
        rejectionLogJooqRepository.delete(log);
        return entityName;
    }

    @Transactional(readOnly = true)
    public boolean checkIfBlocked(String spotifyId, String entityType) {
        return rejectionLogJooqRepository.existsBySpotifyIdAndEntityType(spotifyId, entityType);
    }

    @Transactional
    public void addToBlocklist(String entityType, String spotifyId, String entityName, String reason) {
        RejectionLog rejection = RejectionLog.builder()
            .entityType(entityType)
            .spotifyId(spotifyId)
            .entityName(entityName)
            .reason(reason)
            .deletedContent(false)
            .build();
        rejectionLogJooqRepository.insert(rejection);
    }
}
