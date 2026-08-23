package se.dansbart.domain.suggestion;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.style.AdminStyleConfigService;
import se.dansbart.domain.track.TrackDanceStyleJooqRepository;
import se.dansbart.dto.SuggestionActivationPreviewDto;
import se.dansbart.dto.SuggestionDto;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminSuggestionService {

    private final CommunitySuggestionJooqRepository repository;
    private final AdminStyleConfigService styleConfigService;
    private final TrackDanceStyleJooqRepository danceStyleRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getQueue(String kind, String status, int limit, int offset) {
        List<SuggestionDto> items = repository.findPage(kind, status, limit, offset).stream()
            .map(SuggestionService::toDto)
            .toList();
        long total = repository.count(kind, status);
        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    @Transactional
    public SuggestionDto accept(UUID id, UUID adminId, String reviewNote) {
        getOrThrow(id);
        repository.markReviewed(id, "accepted", adminId, reviewNote);
        return SuggestionService.toDto(getOrThrow(id));
    }

    @Transactional
    public SuggestionDto reject(UUID id, UUID adminId, String reviewNote) {
        getOrThrow(id);
        repository.markReviewed(id, "rejected", adminId, reviewNote);
        return SuggestionService.toDto(getOrThrow(id));
    }

    /**
     * Shows how many tracks a dance-style-config activation would affect, before
     * committing it — beats_per_bar feeds the audio worker's bar-correction DSP pipeline,
     * so this is a deliberate look-before-you-leap step, not just a formality.
     */
    @Transactional(readOnly = true)
    public SuggestionActivationPreviewDto previewActivation(UUID id) {
        CommunitySuggestion s = requireAcceptedDanceStyle(getOrThrow(id));
        String mainStyle = (String) s.getPayload().get("proposedMainStyle");
        String subStyle = (String) s.getPayload().get("proposedSubStyle");
        Integer beatsPerBar = SuggestionService.toInteger(s.getPayload().get("proposedBeatsPerBar"));
        long affected = danceStyleRepository.countDistinctTracksByDanceStyle(mainStyle);
        return SuggestionActivationPreviewDto.builder()
            .mainStyle(mainStyle)
            .subStyle(subStyle)
            .proposedBeatsPerBar(beatsPerBar)
            .affectedTrackCount(affected)
            .build();
    }

    /**
     * Actually writes the proposal into dance_style_config (via the same path direct admin
     * edits use, so duplicate-style validation is shared) and marks the suggestion
     * activated. Only reachable from an already-accepted dance_style suggestion — accepting
     * a suggestion's existence and activating it into production config are deliberately
     * separate steps.
     */
    @Transactional
    public SuggestionDto activate(UUID id) {
        CommunitySuggestion s = requireAcceptedDanceStyle(getOrThrow(id));
        String mainStyle = (String) s.getPayload().get("proposedMainStyle");
        String subStyle = (String) s.getPayload().get("proposedSubStyle");
        Integer beatsPerBar = SuggestionService.toInteger(s.getPayload().get("proposedBeatsPerBar"));

        Map<String, Object> created = styleConfigService.createConfig(mainStyle, subStyle, beatsPerBar);
        UUID configId = UUID.fromString((String) created.get("id"));
        repository.markActivated(id, configId);
        return SuggestionService.toDto(getOrThrow(id));
    }

    private CommunitySuggestion requireAcceptedDanceStyle(CommunitySuggestion s) {
        if (!"dance_style".equals(s.getKind())) {
            throw new IllegalArgumentException("Only dance_style suggestions can be activated");
        }
        if (!"accepted".equals(s.getStatus())) {
            throw new IllegalStateException("Suggestion must be accepted before activation");
        }
        return s;
    }

    private CommunitySuggestion getOrThrow(UUID id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Suggestion not found"));
    }
}
