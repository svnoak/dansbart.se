package se.dansbart.domain.suggestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.SuggestionDto;
import se.dansbart.dto.request.SuggestionCreateRequest;

@RestController
@RequestMapping(value = "/api/suggestions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Suggestions", description = "Community-submitted track/album and dance-style suggestions")
public class SuggestionController {

    private final SuggestionService suggestionService;

    @PostMapping
    @Operation(summary = "Submit a new content or dance-style suggestion (anonymous-friendly)")
    public ResponseEntity<SuggestionDto> create(@RequestBody SuggestionCreateRequest request) {
        try {
            return ResponseEntity.ok(suggestionService.createSuggestion(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
