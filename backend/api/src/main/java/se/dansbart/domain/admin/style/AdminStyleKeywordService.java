package se.dansbart.domain.admin.style;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.StyleKeyword;
import se.dansbart.domain.admin.StyleKeywordRepository;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminStyleKeywordService {

    private final StyleKeywordRepository keywordRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getKeywordsPaginated(String search, String mainStyle, Boolean isActive, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<StyleKeyword> page;

        if (search != null && !search.isBlank()) {
            page = keywordRepository.searchByKeyword(search, pageable);
        } else if (mainStyle != null && !mainStyle.isBlank()) {
            page = keywordRepository.findByMainStyleOrderByKeywordAsc(mainStyle, pageable);
        } else if (isActive != null) {
            page = keywordRepository.findByIsActiveOrderByKeywordAsc(isActive, pageable);
        } else {
            page = keywordRepository.findAllByOrderByKeywordAsc(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapKeyword)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private Map<String, Object> mapKeyword(StyleKeyword keyword) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", keyword.getId().toString());
        item.put("keyword", keyword.getKeyword());
        item.put("main_style", keyword.getMainStyle());
        item.put("sub_style", keyword.getSubStyle());
        item.put("is_active", keyword.getIsActive());
        item.put("created_at", keyword.getCreatedAt() != null ? keyword.getCreatedAt().toString() : null);
        item.put("updated_at", keyword.getUpdatedAt() != null ? keyword.getUpdatedAt().toString() : null);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStats() {
        long totalActive = keywordRepository.countByIsActive(true);
        long totalInactive = keywordRepository.countByIsActive(false);

        Map<String, Long> byStyle = new HashMap<>();
        for (Object[] row : keywordRepository.countByMainStyle()) {
            byStyle.put((String) row[0], (Long) row[1]);
        }

        List<String> uniqueStyles = keywordRepository.findDistinctMainStyles();

        Map<String, Object> result = new HashMap<>();
        result.put("total_active", totalActive);
        result.put("total_inactive", totalInactive);
        result.put("by_style", byStyle);
        result.put("unique_styles", uniqueStyles);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getKeywordById(UUID id) {
        StyleKeyword keyword = keywordRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Keyword not found"));
        return mapKeyword(keyword);
    }

    @Transactional
    public Map<String, Object> createKeyword(String keyword, String mainStyle, String subStyle) {
        if (keywordRepository.existsByKeywordIgnoreCase(keyword)) {
            throw new IllegalArgumentException("Keyword already exists");
        }

        StyleKeyword newKeyword = StyleKeyword.builder()
            .keyword(keyword)
            .mainStyle(mainStyle)
            .subStyle(subStyle)
            .isActive(true)
            .build();

        keywordRepository.save(newKeyword);
        return mapKeyword(newKeyword);
    }

    @Transactional
    public Map<String, Object> updateKeyword(UUID id, String keyword, String mainStyle, String subStyle, Boolean isActive) {
        StyleKeyword existing = keywordRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Keyword not found"));

        if (keyword != null && !keyword.equals(existing.getKeyword())) {
            if (keywordRepository.existsByKeywordIgnoreCase(keyword)) {
                throw new IllegalArgumentException("Keyword already exists");
            }
            existing.setKeyword(keyword);
        }

        if (mainStyle != null) existing.setMainStyle(mainStyle);
        if (subStyle != null) existing.setSubStyle(subStyle);
        if (isActive != null) existing.setIsActive(isActive);
        existing.setUpdatedAt(OffsetDateTime.now());

        keywordRepository.save(existing);
        return mapKeyword(existing);
    }

    @Transactional
    public boolean deleteKeyword(UUID id) {
        if (!keywordRepository.existsById(id)) {
            return false;
        }
        keywordRepository.deleteById(id);
        return true;
    }
}
