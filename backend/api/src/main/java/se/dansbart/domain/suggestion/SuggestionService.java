package se.dansbart.domain.suggestion;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.dto.SuggestionDto;
import se.dansbart.dto.request.SuggestionCreateRequest;
import se.dansbart.voter.VoterContext;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SuggestionService {

    private static final Set<String> VALID_KINDS = Set.of("content", "dance_style");

    private final CommunitySuggestionJooqRepository repository;
    private final VoterContext voterContext;

    /**
     * Creates a suggestion anonymously (voter identity from VoterContext — auth principal
     * or X-Voter-ID, same as everywhere else). Per the "merge suggest+classify" decision,
     * a content suggestion's payload is expected to already carry the submitter's proposed
     * classification (suggestedMainStyle etc.) rather than deferring that to a later step.
     */
    @Transactional
    public SuggestionDto createSuggestion(SuggestionCreateRequest request) {
        UUID voterId = voterContext.getVoterId();
        if (voterId == null) {
            throw new IllegalArgumentException("No voter identity");
        }
        String kind = request.getKind();
        if (kind == null || !VALID_KINDS.contains(kind)) {
            throw new IllegalArgumentException("kind must be 'content' or 'dance_style'");
        }
        Map<String, Object> payload = request.getPayload() != null ? request.getPayload() : Map.of();
        validatePayload(kind, payload);

        CommunitySuggestion suggestion = CommunitySuggestion.builder()
            .kind(kind)
            .payload(payload)
            .note(request.getNote())
            .voterId(voterId)
            .status("pending")
            .build();

        return toDto(repository.save(suggestion));
    }

    private void validatePayload(String kind, Map<String, Object> payload) {
        if ("content".equals(kind)) {
            if (!hasText(payload.get("title"))) {
                throw new IllegalArgumentException("payload.title is required for content suggestions");
            }
        } else {
            if (!hasText(payload.get("proposedMainStyle"))) {
                throw new IllegalArgumentException("payload.proposedMainStyle is required for dance_style suggestions");
            }
            Integer beatsPerBar = toInteger(payload.get("proposedBeatsPerBar"));
            if (beatsPerBar == null || beatsPerBar < 1 || beatsPerBar > 12) {
                throw new IllegalArgumentException("payload.proposedBeatsPerBar must be an integer between 1 and 12");
            }
        }
    }

    private boolean hasText(Object value) {
        return value instanceof String s && !s.isBlank();
    }

    static Integer toInteger(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    static SuggestionDto toDto(CommunitySuggestion s) {
        return SuggestionDto.builder()
            .id(s.getId())
            .kind(s.getKind())
            .payload(s.getPayload())
            .note(s.getNote())
            .voterId(s.getVoterId())
            .status(s.getStatus())
            .reviewedBy(s.getReviewedBy())
            .reviewedAt(s.getReviewedAt())
            .reviewNote(s.getReviewNote())
            .resolvedRefId(s.getResolvedRefId())
            .activatedAt(s.getActivatedAt())
            .createdAt(s.getCreatedAt())
            .build();
    }
}
