package se.dansbart.domain.admin.style;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.DanceStyleConfig;
import se.dansbart.domain.admin.DanceStyleConfigJooqRepository;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminStyleConfigService {

    private final DanceStyleConfigJooqRepository configRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getConfigsPaginated(String mainStyle, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<DanceStyleConfig> page;

        if (mainStyle != null && !mainStyle.isBlank()) {
            page = configRepository.findByMainStylePaginated(mainStyle, pageable);
        } else {
            page = configRepository.findAllPaginated(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapConfig)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getConfigById(UUID id) {
        DanceStyleConfig config = configRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Style config not found"));
        return mapConfig(config);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllActiveConfigs() {
        return configRepository.findByIsActiveTrue().stream()
            .map(this::mapConfig)
            .toList();
    }

    @Transactional
    public Map<String, Object> createConfig(String mainStyle, String subStyle, Integer beatsPerBar) {
        if (mainStyle == null || mainStyle.isBlank()) {
            throw new IllegalArgumentException("mainStyle is required");
        }
        if (beatsPerBar == null || beatsPerBar < 1 || beatsPerBar > 12) {
            throw new IllegalArgumentException("beatsPerBar must be between 1 and 12");
        }
        if (configRepository.existsByMainStyleAndSubStyle(mainStyle, subStyle)) {
            throw new IllegalArgumentException("Config already exists for this style/sub-style combination");
        }

        DanceStyleConfig config = DanceStyleConfig.builder()
            .mainStyle(mainStyle)
            .subStyle(subStyle)
            .beatsPerBar(beatsPerBar)
            .isActive(true)
            .updatedAt(OffsetDateTime.now())
            .build();

        return mapConfig(configRepository.save(config));
    }

    @Transactional
    public Map<String, Object> updateConfig(UUID id, String mainStyle, String subStyle,
                                            Integer beatsPerBar, Boolean isActive) {
        DanceStyleConfig existing = configRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Style config not found"));

        if (mainStyle != null) existing.setMainStyle(mainStyle);
        if (subStyle != null) existing.setSubStyle(subStyle);
        if (beatsPerBar != null) {
            if (beatsPerBar < 1 || beatsPerBar > 12) {
                throw new IllegalArgumentException("beatsPerBar must be between 1 and 12");
            }
            existing.setBeatsPerBar(beatsPerBar);
        }
        if (isActive != null) existing.setIsActive(isActive);
        existing.setUpdatedAt(OffsetDateTime.now());

        return mapConfig(configRepository.save(existing));
    }

    @Transactional
    public boolean deleteConfig(UUID id) {
        if (!configRepository.existsById(id)) {
            return false;
        }
        configRepository.deleteById(id);
        return true;
    }

    private Map<String, Object> mapConfig(DanceStyleConfig config) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", config.getId().toString());
        item.put("mainStyle", config.getMainStyle());
        item.put("subStyle", config.getSubStyle());
        item.put("beatsPerBar", config.getBeatsPerBar());
        item.put("isActive", config.getIsActive());
        item.put("createdAt", config.getCreatedAt() != null ? config.getCreatedAt().toString() : null);
        item.put("updatedAt", config.getUpdatedAt() != null ? config.getUpdatedAt().toString() : null);
        return item;
    }
}
