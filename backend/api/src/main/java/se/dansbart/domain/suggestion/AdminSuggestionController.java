package se.dansbart.domain.suggestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.SuggestionActivationPreviewDto;
import se.dansbart.dto.SuggestionDto;
import se.dansbart.dto.request.SuggestionReviewRequest;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/suggestions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Suggestions", description = "Admin review queue for community suggestions")
public class AdminSuggestionController {

    private final AdminSuggestionService adminSuggestionService;

    @GetMapping
    @Operation(summary = "List suggestions, optionally filtered by kind/status")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(adminSuggestionService.getQueue(kind, status, limit, offset));
    }

    @PostMapping("/{id}/accept")
    @Operation(summary = "Accept a suggestion (does not yet write dance_style_config for dance_style suggestions — see /activate)")
    public ResponseEntity<SuggestionDto> accept(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID adminId,
            @RequestBody(required = false) SuggestionReviewRequest request) {
        try {
            return ResponseEntity.ok(adminSuggestionService.accept(id, adminId, reviewNote(request)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a suggestion")
    public ResponseEntity<SuggestionDto> reject(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID adminId,
            @RequestBody(required = false) SuggestionReviewRequest request) {
        try {
            return ResponseEntity.ok(adminSuggestionService.reject(id, adminId, reviewNote(request)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/activation-preview")
    @Operation(summary = "Preview how many tracks a dance-style activation would affect, before committing it")
    public ResponseEntity<SuggestionActivationPreviewDto> activationPreview(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(adminSuggestionService.previewActivation(id));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/activate")
    @Operation(summary = "Write an accepted dance_style suggestion into dance_style_config")
    public ResponseEntity<SuggestionDto> activate(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(adminSuggestionService.activate(id));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private String reviewNote(SuggestionReviewRequest request) {
        return request != null ? request.getReviewNote() : null;
    }
}
